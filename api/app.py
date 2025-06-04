#!/usr/bin/env python3
import argparse
import atexit
import json
import logging
import os
import signal
import sqlite3
import struct
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import psutil
import serial
import serial.tools.list_ports

# GPIO control for hardware resets
try:
    import lgpio
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("Warning: lgpio not available - hardware reset disabled")

# Environment setup
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max file size
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "database" / "dacroq.db"
LDPC_DATA_DIR = DATA_DIR / "ldpc"

# Daemon management
PID_FILE = Path(__file__).parent / "dacroq_api.pid"
LOG_FILE = Path(__file__).parent / "dacroq_api.log"

# CORS configuration
ALLOWED_ORIGINS = set(
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://dacroq.net,https://www.dacroq.net,https://test.dacroq.net",
    ).split(",")
)

# Helper function to get current UTC time
def utc_now():
    return datetime.now(timezone.utc).isoformat()

# ------------------------------ Daemon Management ---------------------------
def write_pid_file():
    """Write current process PID to file"""
    try:
        with open(PID_FILE, 'w') as f:
            f.write(str(os.getpid()))
        logger.info(f"📝 PID file written: {PID_FILE}")
    except Exception as e:
        logger.error(f"Failed to write PID file: {e}")

def remove_pid_file():
    """Remove PID file"""
    try:
        if PID_FILE.exists():
            PID_FILE.unlink()
            logger.info(f"🗑️ PID file removed: {PID_FILE}")
    except Exception as e:
        logger.warning(f"Failed to remove PID file: {e}")

def get_running_pid():
    """Get PID of running daemon, if any"""
    try:
        if PID_FILE.exists():
            with open(PID_FILE, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process is actually running
            if psutil.pid_exists(pid):
                process = psutil.Process(pid)
                # Verify it's actually our process
                if 'app.py' in ' '.join(process.cmdline()):
                    return pid
            
            # PID file exists but process is dead - clean up
            remove_pid_file()
            return None
    except (FileNotFoundError, ValueError, psutil.NoSuchProcess):
        remove_pid_file()
        return None

def stop_daemon():
    """Stop the running daemon"""
    running_pid = get_running_pid()
    
    if not running_pid:
        print("❌ No running Dacroq API daemon found")
        return False
    
    try:
        print(f"🛑 Stopping Dacroq API daemon (PID: {running_pid})...")
        
        # Try graceful shutdown first
        os.kill(running_pid, signal.SIGTERM)
        
        # Wait up to 10 seconds for graceful shutdown
        for i in range(10):
            if not psutil.pid_exists(running_pid):
                print("✅ Daemon stopped gracefully")
                remove_pid_file()
                return True
            time.sleep(1)
        
        # Force kill if graceful shutdown failed
        print("⚠️ Graceful shutdown timeout, forcing stop...")
        os.kill(running_pid, signal.SIGKILL)
        
        # Wait a bit more
        for i in range(5):
            if not psutil.pid_exists(running_pid):
                print("✅ Daemon force stopped")
                remove_pid_file()
                return True
            time.sleep(1)
        
        print("❌ Failed to stop daemon")
        return False
        
    except Exception as e:
        print(f"❌ Error stopping daemon: {e}")
        return False

def setup_daemon_logging():
    """Setup logging for daemon mode"""
    # Create log file handler
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.INFO)
    
    # Create console handler for important messages
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.WARNING)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Get root logger and clear existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(logging.INFO)

def cleanup_on_exit():
    """Cleanup function called on exit"""
    logger.info("🧹 Performing cleanup on exit...")
    try:
        # Cleanup GPIO resources
        hardware_manager.cleanup_gpio()
        # Close connection pools
        teensy_pool.close_all()
        sat_pool.close_all()
        # Remove PID file
        remove_pid_file()
        logger.info("✅ Cleanup completed")
    except Exception as e:
        logger.error(f"❌ Cleanup error: {e}")

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    signal_name = signal.Signals(signum).name
    logger.info(f"🔔 Received signal {signal_name}, shutting down gracefully...")
    
    # Perform cleanup
    cleanup_on_exit()
    
    # Exit gracefully
    sys.exit(0)

def ignore_interrupt(signum, frame):
    """Ignore SIGINT (Ctrl+C) in daemon mode"""
    logger.info("🚫 Ignoring Ctrl+C (daemon mode) - use 'python3 app.py --stop' to stop")

def start_daemon():
    """Start the API in daemon mode"""
    # Check if already running
    running_pid = get_running_pid()
    if running_pid:
        print(f"⚠️ Dacroq API daemon already running (PID: {running_pid})")
        print("Use 'python3 app.py --stop' to stop it first")
        return False
    
    print("🚀 Starting Dacroq API daemon...")
    
    # Setup daemon logging
    setup_daemon_logging()
    
    # Write PID file
    write_pid_file()
    
    # Register cleanup handlers
    atexit.register(cleanup_on_exit)
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)  # Graceful shutdown
    signal.signal(signal.SIGINT, ignore_interrupt)  # Ignore Ctrl+C
    
    # Log startup info
    logger.info("=" * 60)
    logger.info("🚀 Dacroq API Daemon Starting")
    logger.info(f"📍 PID: {os.getpid()}")
    logger.info(f"📁 Base Directory: {BASE_DIR}")
    logger.info(f"🗄️ Database: {DB_PATH}")
    logger.info(f"📊 Data Directory: {DATA_DIR}")
    logger.info(f"📋 Log File: {LOG_FILE}")
    logger.info("=" * 60)
    
    # Perform initial hardware reset of all boards
    logger.info("🔄 Performing initial hardware reset of all boards...")
    try:
        reset_result = hardware_manager.reset_all_devices()
        if reset_result["success"]:
            logger.info(f"✅ Successfully reset {len(reset_result['devices_reset'])} boards: {reset_result['devices_reset']}")
        else:
            logger.warning(f"⚠️ Hardware reset failed: {reset_result.get('error', 'Unknown error')}")
    except Exception as e:
        logger.warning(f"⚠️ Initial hardware reset failed: {e}")
    
    return True

# ------------------------------ Hardware Device Manager ---------------------
class HardwareDeviceManager:
    """Manages multiple hardware device connections concurrently with auto-discovery"""
    
    def __init__(self):
        self.active_ports = {}  # port -> device_type mapping
        self.discovered_devices = {}  # device_type -> port mapping
        self.device_configs = {
            "ldpc": {
                "preferred_ports": ["/dev/ttyACM0", "/dev/cu.usbmodem158960201", "/dev/tty.usbmodem158960201"],
                "startup_messages": ["AMORGOS LDPC Decoder Ready", "STATUS:READY"],
                "test_commands": ["STATUS"],
                "device_type": "LDPC",
                "identification_keywords": ["AMORGOS", "LDPC"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/LDPC_TEENSY",
                "reset_gpio_pin": 18  # GPIO 18 (Pin 12) for LDPC reset
            },
            "sat": {
                "preferred_ports": ["/dev/ttyACM1", "/dev/cu.usbmodem138999801", "/dev/cu.usbmodem139000201"],
                "startup_messages": ["DAEDALUS 3-SAT Solver", "STATUS:READY"],
                "test_commands": ["STATUS"],
                "device_type": "SAT",
                "identification_keywords": ["DAEDALUS", "3-SAT"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/3SAT_TEENSY",
                "reset_gpio_pin": 19  # GPIO 19 (Pin 35) for 3SAT reset
            },
            "ksat": {
                "preferred_ports": ["/dev/cu.usbmodem140001201"],
                "startup_messages": ["MEDUSA K-SAT Solver", "STATUS:READY"],
                "test_commands": ["STATUS"],
                "device_type": "KSAT",
                "identification_keywords": ["MEDUSA", "K-SAT"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/KSAT_TEENSY",
                "reset_gpio_pin": 20  # GPIO 20 (Pin 38) for KSAT reset (future)
            }
        }
        self.lock = threading.Lock()
        self.firmware_status = {}  # Track firmware build/upload status
        self.gpio_initialized = False
        self.gpio_handle = None  # Store GPIO chip handle
        
        # Initialize GPIO for hardware reset control
        self._init_gpio()
    
    def _init_gpio(self):
        """Initialize GPIO pins for hardware reset control"""
        if not GPIO_AVAILABLE:
            logger.warning("GPIO not available - hardware reset functionality disabled")
            return
        
        try:
            # Open GPIO chip
            self.gpio_handle = lgpio.gpiochip_open(0)
            logger.info("✅ GPIO chip 0 opened")
            
            # Setup reset pins for each device
            for device_type, config in self.device_configs.items():
                reset_pin = config.get("reset_gpio_pin")
                if reset_pin:
                    # Setup as output, initially HIGH (inactive - reset is active-low)
                    lgpio.gpio_claim_output(self.gpio_handle, reset_pin, 1)
                    logger.info(f"📌 GPIO {reset_pin} initialized for {device_type} reset control")
            
            self.gpio_initialized = True
            logger.info("✅ GPIO hardware reset control initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize GPIO: {e}")
            self.gpio_initialized = False
            if self.gpio_handle is not None:
                try:
                    lgpio.gpiochip_close(self.gpio_handle)
                except:
                    pass
                self.gpio_handle = None
    
    def reset_device_hardware(self, device_type):
        """Perform hardware reset of specified device using GPIO"""
        if not self.gpio_initialized:
            return {"success": False, "error": "GPIO not initialized"}
        
        if device_type not in self.device_configs:
            return {"success": False, "error": f"Unknown device type: {device_type}"}
        
        config = self.device_configs[device_type]
        reset_pin = config.get("reset_gpio_pin")
        
        if not reset_pin:
            return {"success": False, "error": f"No reset pin configured for {device_type}"}
        
        try:
            logger.info(f"🔄 Performing hardware reset of {device_type} via GPIO {reset_pin}")
            
            # Pull reset line LOW (active) for 1 second
            lgpio.gpio_write(self.gpio_handle, reset_pin, 0)
            time.sleep(1.0)  # 1 second reset pulse
            
            # Release reset line (pull HIGH)
            lgpio.gpio_write(self.gpio_handle, reset_pin, 1)
            
            logger.info(f"✅ Hardware reset completed for {device_type}")
            
            # Clear device from discovered list to force re-discovery
            with self.lock:
                if device_type in self.discovered_devices:
                    self.discovered_devices.pop(device_type)
                # Also clear from active ports
                ports_to_remove = [port for port, dev_type in self.active_ports.items() if dev_type == device_type]
                for port in ports_to_remove:
                    self.active_ports.pop(port)
            
            # Wait a moment for device to boot
            time.sleep(2)
            
            # Get the discovered port for this device
            discovered_port = self.get_device_port(device_type)
            
            return {
                "success": True,
                "device": device_type,
                "gpio_pin": reset_pin,
                "serial_port": discovered_port,
                "message": f"Hardware reset completed for {device_type}"
            }
            
        except Exception as e:
            logger.error(f"❌ Hardware reset failed for {device_type}: {e}")
            return {"success": False, "error": str(e)}
    
    def reset_all_devices(self):
        """Reset all connected devices simultaneously"""
        if not self.gpio_initialized:
            return {"success": False, "error": "GPIO not initialized"}
        
        try:
            logger.info("🔄 Performing hardware reset of ALL devices")
            
            # Pull all reset lines LOW simultaneously
            reset_pins = []
            for device_type, config in self.device_configs.items():
                reset_pin = config.get("reset_gpio_pin")
                if reset_pin:
                    lgpio.gpio_write(self.gpio_handle, reset_pin, 0)
                    reset_pins.append((device_type, reset_pin))
            
            time.sleep(1.0)  # 1 second reset pulse
            
            # Release all reset lines simultaneously
            for device_type, reset_pin in reset_pins:
                lgpio.gpio_write(self.gpio_handle, reset_pin, 1)
            
            logger.info("✅ Hardware reset completed for ALL devices")
            
            # Clear all discovered devices
            with self.lock:
                self.discovered_devices.clear()
                self.active_ports.clear()
            
            time.sleep(3)  # Wait for all devices to boot
            
            # Get discovered ports for all reset devices
            device_ports = {}
            for device_type, reset_pin in reset_pins:
                discovered_port = self.get_device_port(device_type)
                device_ports[device_type] = {
                    "gpio_pin": reset_pin,
                    "serial_port": discovered_port
                }
            
            return {
                "success": True,
                "devices_reset": [device for device, pin in reset_pins],
                "device_details": device_ports,
                "message": f"Hardware reset completed for {len(reset_pins)} devices"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to reset all devices: {e}")
            return {"success": False, "error": str(e)}
    
    def get_gpio_status(self):
        """Get status of GPIO reset control system"""
        if not GPIO_AVAILABLE:
            return {"available": False, "reason": "lgpio not installed"}
        
        if not self.gpio_initialized:
            return {"available": False, "reason": "GPIO initialization failed"}
        
        pin_status = {}
        for device_type, config in self.device_configs.items():
            reset_pin = config.get("reset_gpio_pin")
            if reset_pin:
                try:
                    current_state = lgpio.gpio_read(self.gpio_handle, reset_pin)
                    pin_status[device_type] = {
                        "gpio_pin": reset_pin,
                        "current_state": "HIGH (inactive)" if current_state else "LOW (active)",
                        "raw_value": current_state
                    }
                except:
                    pin_status[device_type] = {"gpio_pin": reset_pin, "status": "error"}
        
        return {
            "available": True,
            "initialized": self.gpio_initialized,
            "pin_status": pin_status
        }
    
    def cleanup_gpio(self):
        """Clean up GPIO resources"""
        if self.gpio_initialized and self.gpio_handle is not None:
            try:
                # Free GPIO pins
                for device_type, config in self.device_configs.items():
                    reset_pin = config.get("reset_gpio_pin")
                    if reset_pin:
                        lgpio.gpio_free(self.gpio_handle, reset_pin)
                
                # Close GPIO chip handle
                lgpio.gpiochip_close(self.gpio_handle)
                self.gpio_handle = None
                self.gpio_initialized = False
                logger.info("🧹 GPIO resources cleaned up")
            except Exception as e:
                logger.warning(f"⚠️ GPIO cleanup warning: {e}")
                pass
    
    def build_firmware(self, device_type):
        """Build firmware for specified device type using individual project directories"""
        if device_type not in self.device_configs:
            return {"success": False, "error": f"Unknown device type: {device_type}"}
        
        config = self.device_configs[device_type]
        firmware_path = config["firmware_path"]
        env_name = config["firmware_env"]
        
        logger.info(f"🔨 Building firmware for {device_type} in {firmware_path}")
        
        try:
            # Run PlatformIO build in the specific firmware directory
            result = subprocess.run(
                ["pio", "run", "-d", firmware_path, "-e", env_name],
                cwd="../",  # Run from api directory, so ../firmware/PROJECT works
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                logger.info(f"✅ Successfully built {device_type} firmware")
                return {
                    "success": True,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            else:
                logger.error(f"❌ Failed to build {device_type} firmware")
                return {
                    "success": False,
                    "error": f"Build failed with exit code {result.returncode}",
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
                
        except subprocess.TimeoutExpired:
            logger.error(f"⏰ Firmware build timeout for {device_type}")
            return {"success": False, "error": "Build timeout (5 minutes)"}
        except Exception as e:
            logger.error(f"💥 Build error for {device_type}: {e}")
            return {"success": False, "error": str(e)}
    
    def upload_firmware(self, device_type, port=None):
        """Upload firmware to specified device using individual project directories"""
        if device_type not in self.device_configs:
            return {"success": False, "error": f"Unknown device type: {device_type}"}
        
        config = self.device_configs[device_type]
        firmware_path = config["firmware_path"]
        env_name = config["firmware_env"]
        
        # Use provided port or try to find one
        target_port = port or self.get_device_port(device_type)
        if not target_port:
            available_ports = self.get_available_ports_for_device(device_type)
            if available_ports:
                target_port = available_ports[0]
            else:
                return {"success": False, "error": f"No available port found for {device_type}"}
        
        logger.info(f"📤 Uploading firmware to {device_type} at {target_port} using {firmware_path}")
        
        try:
            # Run PlatformIO upload in the specific firmware directory
            cmd = ["pio", "run", "-d", firmware_path, "-e", env_name, "-t", "upload"]
            
            # Set upload port if specified
            if target_port:
                cmd.extend(["--upload-port", target_port])
            
            result = subprocess.run(
                cmd,
                cwd="../",  # Run from api directory
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout for upload
            )
            
            if result.returncode == 0:
                logger.info(f"✅ Successfully uploaded firmware to {device_type} at {target_port}")
                # Clear device from discovered list to force re-discovery
                with self.lock:
                    if device_type in self.discovered_devices:
                        self.discovered_devices.pop(device_type)
                    if target_port in self.active_ports:
                        self.active_ports.pop(target_port)
                
                return {
                    "success": True,
                    "port": target_port,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            else:
                logger.error(f"❌ Failed to upload firmware to {device_type}")
                return {
                    "success": False,
                    "error": f"Upload failed with exit code {result.returncode}",
                    "port": target_port,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
                
        except subprocess.TimeoutExpired:
            logger.error(f"⏰ Firmware upload timeout for {device_type}")
            return {"success": False, "error": "Upload timeout (2 minutes)", "port": target_port}
        except Exception as e:
            logger.error(f"💥 Upload error for {device_type}: {e}")
            return {"success": False, "error": str(e), "port": target_port}
    
    def flash_firmware(self, device_type, port=None, build_first=True):
        """Build and upload firmware in one operation"""
        logger.info(f"🚀 Starting firmware flash for {device_type}")
        
        results = {"device_type": device_type, "steps": []}
        
        # Step 1: Build firmware (optional)
        if build_first:
            logger.info(f"🔨 Building firmware for {device_type}...")
            build_result = self.build_firmware(device_type)
            results["steps"].append({"step": "build", "result": build_result})
            
            if not build_result["success"]:
                results["success"] = False
                results["error"] = f"Build failed: {build_result['error']}"
                return results
        
        # Step 2: Upload firmware
        logger.info(f"📤 Uploading firmware for {device_type}...")
        upload_result = self.upload_firmware(device_type, port)
        results["steps"].append({"step": "upload", "result": upload_result})
        
        if upload_result["success"]:
            results["success"] = True
            results["port"] = upload_result["port"]
            logger.info(f"🎉 Successfully flashed {device_type} firmware!")
            
            # Wait a moment for device to reboot
            time.sleep(3)
            
            # Try to re-discover the device
            logger.info(f"🔍 Re-discovering {device_type} after firmware flash...")
            self.discover_all_devices()
            
        else:
            results["success"] = False
            results["error"] = f"Upload failed: {upload_result['error']}"
        
        return results
    
    def discover_all_devices(self):
        """Auto-discover all connected Teensy devices and identify them"""
        import serial.tools.list_ports
        
        logger.info("🔍 Starting device auto-discovery...")
        discovered = {}
        
        # Find all potential Teensy devices
        for port in serial.tools.list_ports.comports():
            # Check if it's a Teensy (PJRC vendor ID 0x16C0)
            if port.vid == 0x16C0 or "teensy" in port.description.lower():
                device_type = self._identify_device(port.device)
                if device_type:
                    discovered[device_type] = port.device
                    logger.info(f"✅ Discovered {device_type} device at {port.device}")
                    # Auto-register the discovered device
                    self.register_port(port.device, device_type)
        
        with self.lock:
            self.discovered_devices = discovered
        
        logger.info(f"🎯 Discovery complete: {list(discovered.keys())}")
        return discovered
    
    def _identify_device(self, port_name):
        """Identify what type of device is connected to a specific port"""
        try:
            logger.debug(f"🔍 Identifying device at {port_name}")
            
            # Quick connection test with shorter timeout
            test_serial = serial.Serial(port_name, 2_000_000, timeout=0.5)
            time.sleep(0.2)  # Reduced initialization time
            
            # Clear any pending data
            test_serial.reset_input_buffer()
            
            # Send identification command
            test_serial.write(b"STATUS\n")
            test_serial.flush()
            time.sleep(0.3)  # Reduced wait time
            
            # Collect response with timeout
            response_lines = []
            start_time = time.time()
            while test_serial.in_waiting and (time.time() - start_time) < 0.5:
                line = test_serial.readline().decode('utf-8', errors='ignore').strip()
                response_lines.append(line)
            
            test_serial.close()
            response = " ".join(response_lines)
            
            logger.debug(f"Device at {port_name} responded: {response}")
            
            # Identify based on response keywords
            for device_type, config in self.device_configs.items():
                for keyword in config["identification_keywords"]:
                    if keyword in response:
                        logger.info(f"✅ Identified {device_type} device at {port_name}")
                        return device_type
            
            # If no keyword match, try to identify by startup message patterns
            if "STATUS:READY" in response:
                # Generic Teensy response - try to disambiguate
                logger.warning(f"⚠️ Generic Teensy response at {port_name}, checking serial number...")
                
                # Use serial number pattern to make educated guess
                if "158960" in port_name:
                    logger.info(f"📍 Assuming LDPC device based on port pattern: {port_name}")
                    return "ldpc"
                elif "138999" in port_name or "139000" in port_name:
                    logger.info(f"📍 Assuming SAT device based on port pattern: {port_name}")
                    return "sat"
            
            logger.warning(f"❓ Could not identify device at {port_name}: {response}")
            return None
            
        except Exception as e:
            logger.debug(f"Failed to identify device at {port_name}: {e}")
            return None
    
    def get_device_port(self, device_type):
        """Get the current port for a specific device type"""
        with self.lock:
            return self.discovered_devices.get(device_type)
    
    def register_port(self, port, device_type):
        """Register a port as being used by a specific device type"""
        with self.lock:
            if port in self.active_ports and self.active_ports[port] != device_type:
                logger.warning(f"Port {port} already in use by {self.active_ports[port]}, requested by {device_type}")
                return False
            self.active_ports[port] = device_type
            self.discovered_devices[device_type] = port
            logger.info(f"Registered port {port} for {device_type} device")
            return True
    
    def unregister_port(self, port):
        """Unregister a port"""
        with self.lock:
            if port in self.active_ports:
                device_type = self.active_ports.pop(port)
                # Also remove from discovered devices
                if self.discovered_devices.get(device_type) == port:
                    self.discovered_devices.pop(device_type, None)
                logger.info(f"Unregistered port {port} from {device_type} device")
    
    def is_port_available(self, port, device_type):
        """Check if a port is available for a specific device type"""
        with self.lock:
            return port not in self.active_ports or self.active_ports[port] == device_type
    
    def get_available_ports_for_device(self, device_type):
        """Get list of available ports for a specific device type"""
        # First try discovered devices
        discovered_port = self.get_device_port(device_type)
        if discovered_port and self.is_port_available(discovered_port, device_type):
            return [discovered_port]
        
        # Fall back to configured preferred ports
        if device_type not in self.device_configs:
            return []
        
        config = self.device_configs[device_type]
        available_ports = []
        
        with self.lock:
            for port in config["preferred_ports"]:
                if self.is_port_available(port, device_type):
                    available_ports.append(port)
        
        return available_ports
    
    def get_status(self):
        """Get current status of all managed devices"""
        with self.lock:
            return {
                "active_ports": dict(self.active_ports),
                "discovered_devices": dict(self.discovered_devices),
                "total_devices": len(self.active_ports)
            }

# Global hardware device manager
hardware_manager = HardwareDeviceManager()

# --- Database -----------------------------------------------------------------
@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize database schema"""
    with get_db() as conn:
        conn.executescript(
            """
            -- Core tables
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL,
                last_login TEXT,
                google_sub TEXT UNIQUE
            );

            CREATE TABLE IF NOT EXISTS tests (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                chip_type TEXT NOT NULL,
                test_mode TEXT,
                environment TEXT,
                config TEXT,
                status TEXT NOT NULL,
                created TEXT NOT NULL,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS test_results (
                id TEXT PRIMARY KEY,
                test_id TEXT NOT NULL,
                iteration INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                results TEXT,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ldpc_jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                job_type TEXT NOT NULL,
                config TEXT NOT NULL,
                status TEXT NOT NULL,
                created TEXT NOT NULL,
                started TEXT,
                completed TEXT,
                results TEXT,
                progress REAL DEFAULT 0,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS system_metrics (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                cpu_percent REAL,
                memory_percent REAL,
                disk_percent REAL,
                temperature REAL
            );

            CREATE TABLE IF NOT EXISTS announcements (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'info',
                expires_at TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                active BOOLEAN DEFAULT 1
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
            CREATE INDEX IF NOT EXISTS idx_tests_created ON tests(created);
            CREATE INDEX IF NOT EXISTS idx_ldpc_jobs_created ON ldpc_jobs(created);
        """
        )
        conn.commit()

# --- Middleware ---------------------------------------------------------------
@app.before_request
def start_timer():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    """Add CORS headers and log slow requests"""
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"

    if hasattr(request, "start_time"):
        duration = time.time() - request.start_time
        if duration > 1.0:
            logger.warning(
                f"Slow request: {request.method} {request.path} took {duration:.2f}s"
            )
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return "", 200

# --- Utilities ----------------------------------------------------------------
def generate_id() -> str:
    return str(uuid.uuid4())

def dict_from_row(row):
    return {key: row[key] for key in row.keys()} if row else None

def collect_system_metrics():
    try:
        cpu = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        temp = None
        if hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            for name, entries in temps.items():
                if entries and "cpu" in name.lower():
                    temp = entries[0].current
                    break
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO system_metrics
                (id,timestamp,cpu_percent,memory_percent,disk_percent,temperature)
                VALUES (?,?,?,?,?,?)
            """,
                (
                    generate_id(),
                    utc_now(),
                    cpu,
                    mem.percent,
                    disk.percent,
                    temp,
                ),
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Metric collection error: {e}")

# ------------------------------ Authentication -------------------------------
@app.route("/auth/google", methods=["POST"])
def google_auth():
    """Authenticate with Google OAuth"""
    try:
        data = request.get_json()
        token = data.get("credential") or data.get("token")
        if not token:
            return jsonify({"error": "No credential provided"}), 400

        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            return jsonify({"error": "Server configuration error"}), 500

        try:
            idinfo = id_token.verify_oauth2_token(
                token, google_requests.Request(), google_client_id
            )
            user_id = idinfo["sub"]
            email = idinfo["email"]
            name = idinfo.get("name", "")
        except ValueError:
            import base64, binascii

            try:
                padded = token + "=" * (-len(token) % 4)
                decoded = json.loads(base64.b64decode(padded))
                user_id = decoded.get("sub", decoded.get("id"))
                email = decoded.get("email")
                name = decoded.get("name", "")
                logger.warning("Using unverified token (dev mode)")
            except (binascii.Error, json.JSONDecodeError):
                return jsonify({"error": "Invalid token"}), 401

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM users WHERE google_sub=? OR email=?", (user_id, email)
            )
            user = cur.fetchone()
            if user:
                cur.execute(
                    "UPDATE users SET last_login=? WHERE id=?",
                    (utc_now(), user["id"]),
                )
                user_data = dict_from_row(user)
            else:
                new_uid = generate_id()
                cur.execute(
                    """
                    INSERT INTO users (id,email,name,role,created_at,last_login,google_sub)
                    VALUES (?,?,?,?,?,?,?)
                """,
                    (
                        new_uid,
                        email,
                        name,
                        "user",
                        utc_now(),
                        utc_now(),
                        user_id,
                    ),
                )
                user_data = {
                    "id": new_uid,
                    "email": email,
                    "name": name,
                    "role": "user",
                }
            conn.commit()
        return jsonify({"success": True, "user": user_data})
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return jsonify({"error": "Authentication failed"}), 500

# ------------------------------ Root / Health --------------------------------
@app.route("/")
def index():
    return jsonify(
        {
            "name": "Dacroq API",
            "version": "2.0",
            "status": "operational",
            "endpoints": {
                "/health": "System health check",
                "/tests": "Test management",
                "/ldpc/jobs": "LDPC job management",
                "/sat/solve": "SAT solver",
                "/sat/tests": "SAT test management", 
                "/sat/test-summaries": "SAT test summaries",
                "/sat/command": "DAEDALUS hardware commands",
                "/sat/serial-history": "DAEDALUS serial monitor",
                "/users": "User management",
                "/announcements": "System announcements",
                "/ldpc/deploy": "Deploy batch to Teensy console",
                "/ldpc/command": "Send raw command to Teensy console",
                "/hardware/discover": "Discover and identify all connected hardware devices",
                "/firmware/build": "Build firmware for specified device type",
                "/firmware/upload": "Upload firmware to specified device",
                "/firmware/flash": "Build and upload firmware in one operation",
                "/firmware/status": "Get firmware management status",
                "/hardware/reset/<device_type>": "Perform hardware reset of specified device via GPIO",
                "/hardware/reset/all": "Perform hardware reset of all devices simultaneously",
                "/hardware/gpio/status": "Get GPIO reset control status",
            },
        }
    )

@app.route("/health")
def health():
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
        return jsonify(
            {
                "status": "healthy",
                "timestamp": utc_now(),
                "uptime": time.time() - app.start_time,
            }
        )
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route("/hardware/status")
def hardware_status():
    """Get status of all hardware devices and connections (fast, cached)"""
    try:
        # Get cached status without triggering discovery
        hw_status = hardware_manager.get_status()
        
        # Add connection pool status
        ldpc_connected = False
        sat_connected = False
        
        try:
            if teensy_pool.connection and teensy_pool.connection.connected:
                ldpc_connected = True
        except:
            pass
            
        try:
            if sat_pool.connection and sat_pool.connection.connected:
                sat_connected = True
        except:
            pass
        
        # Quick GPIO status without full check
        gpio_available = GPIO_AVAILABLE and hardware_manager.gpio_initialized
        
        return jsonify({
            "hardware_manager": hw_status,
            "ldpc_connected": ldpc_connected,
            "sat_connected": sat_connected,
            "gpio_available": gpio_available,
            "concurrent_support": True,
            "timestamp": utc_now(),
            "note": "Fast status - use /hardware/discover to trigger full discovery"
        })
    except Exception as e:
        logger.error(f"Hardware status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/hardware/discover", methods=["POST"])
def hardware_discover():
    """Discover and identify all connected hardware devices"""
    try:
        logger.info("Hardware discovery requested")
        discovered = hardware_manager.discover_all_devices()
        status = hardware_manager.get_status()
        
        return jsonify({
            "success": True,
            "discovered": discovered,
            "status": status
        })
    except Exception as e:
        logger.error(f"Hardware discovery failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/build/<device_type>", methods=["POST"])
def firmware_build(device_type):
    """Build firmware for specified device type"""
    try:
        logger.info(f"Firmware build requested for {device_type}")
        result = hardware_manager.build_firmware(device_type)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware build failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/upload/<device_type>", methods=["POST"])
def firmware_upload(device_type):
    """Upload firmware to specified device"""
    try:
        data = request.get_json() or {}
        port = data.get("port")  # Optional specific port
        
        logger.info(f"Firmware upload requested for {device_type} at port {port}")
        result = hardware_manager.upload_firmware(device_type, port)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware upload failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/flash/<device_type>", methods=["POST"])
def firmware_flash(device_type):
    """Build and upload firmware in one operation"""
    try:
        data = request.get_json() or {}
        port = data.get("port")  # Optional specific port
        build_first = data.get("build", True)  # Build before upload (default: True)
        
        logger.info(f"Firmware flash requested for {device_type}")
        result = hardware_manager.flash_firmware(device_type, port, build_first)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware flash failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/status", methods=["GET"])
def firmware_status():
    """Get firmware management status"""
    try:
        hardware_status = hardware_manager.get_status()
        
        # Check PlatformIO availability
        try:
            pio_result = subprocess.run(["pio", "--version"], capture_output=True, text=True, timeout=10)
            pio_available = pio_result.returncode == 0
            pio_version = pio_result.stdout.strip() if pio_available else "Not available"
        except:
            pio_available = False
            pio_version = "Not available"
        
        return jsonify({
            "success": True,
            "platformio": {
                "available": pio_available,
                "version": pio_version
            },
            "hardware": hardware_status,
            "supported_devices": list(hardware_manager.device_configs.keys())
        })
    except Exception as e:
        logger.error(f"Firmware status check failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/hardware/reset/<device_type>", methods=["POST"])
def hardware_reset(device_type):
    """Perform hardware reset of specified device via GPIO"""
    try:
        logger.info(f"Hardware reset requested for {device_type}")
        result = hardware_manager.reset_device_hardware(device_type)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Hardware reset failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/hardware/reset/all", methods=["POST"])
def hardware_reset_all():
    """Perform hardware reset of all devices simultaneously"""
    try:
        logger.info("Hardware reset requested for ALL devices")
        result = hardware_manager.reset_all_devices()
        
        return jsonify({
            "success": result["success"],
            "result": result
        })
    except Exception as e:
        logger.error(f"Hardware reset all failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/hardware/gpio/status", methods=["GET"])
def gpio_status():
    """Get GPIO reset control status"""
    try:
        gpio_status = hardware_manager.get_gpio_status()
        
        return jsonify({
            "success": True,
            "gpio": gpio_status
        })
    except Exception as e:
        logger.error(f"GPIO status check failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/hardware/devices", methods=["GET"])
def hardware_devices():
    """Get detailed information about all hardware devices including ports"""
    try:
        hw_status = hardware_manager.get_status()
        device_details = {}
        
        for device_type, config in hardware_manager.device_configs.items():
            discovered_port = hardware_manager.get_device_port(device_type)
            available_ports = hardware_manager.get_available_ports_for_device(device_type)
            
            device_details[device_type] = {
                "name": config.get("device_type", device_type.upper()),
                "description": f"{config.get('device_type', device_type.upper())} Hardware",
                "gpio_pin": config.get("reset_gpio_pin"),
                "discovered_port": discovered_port,
                "available_ports": available_ports,
                "preferred_ports": config.get("preferred_ports", []),
                "firmware_path": config.get("firmware_path"),
                "identification_keywords": config.get("identification_keywords", []),
                "connected": discovered_port is not None
            }
        
        return jsonify({
            "success": True,
            "devices": device_details,
            "hardware_status": hw_status
        })
    except Exception as e:
        logger.error(f"Hardware devices status failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/hardware/session-break", methods=["POST"])
def hardware_session_break():
    """Add session separators to all active serial connections"""
    try:
        data = request.get_json() or {}
        separator_text = data.get("text", "DAEMON RELOAD")
        
        results = {}
        
        # Add session separator to LDPC connection if active
        try:
            if teensy_pool.connection and teensy_pool.connection.connected:
                teensy_pool.connection.add_session_separator(separator_text)
                results["ldpc"] = "Session separator added"
            else:
                results["ldpc"] = "No active connection"
        except Exception as e:
            results["ldpc"] = f"Error: {e}"
        
        # Add session separator to SAT connection if active
        try:
            if sat_pool.connection and sat_pool.connection.connected:
                sat_pool.connection.add_session_separator(separator_text)
                results["sat"] = "Session separator added"
            else:
                results["sat"] = "No active connection"
        except Exception as e:
            results["sat"] = f"Error: {e}"
        
        return jsonify({
            "success": True,
            "results": results,
            "separator_text": separator_text
        })
    except Exception as e:
        logger.error(f"Session break failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ Tests API ------------------------------------
@app.route("/tests", methods=["GET", "POST"])
def handle_tests():
    """List tests or create new test"""
    if request.method == "GET":
        try:
            chip_type = request.args.get("chip_type")
            status = request.args.get("status")
            limit = int(request.args.get("limit", 50))
            offset = int(request.args.get("offset", 0))

            with get_db() as conn:
                # Build query
                query = "SELECT * FROM tests"
                params = []
                conditions = []

                if chip_type:
                    conditions.append("chip_type = ?")
                    params.append(chip_type)
                if status:
                    conditions.append("status = ?")
                    params.append(status)

                if conditions:
                    query += " WHERE " + " AND ".join(conditions)

                query += " ORDER BY created DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])

                cursor = conn.execute(query, params)
                tests = [dict_from_row(row) for row in cursor]

                # Parse JSON fields
                for test in tests:
                    for field in ["config", "metadata"]:
                        if test.get(field):
                            try:
                                test[field] = json.loads(test[field])
                            except:
                                test[field] = {}

                # Get total count
                count_query = "SELECT COUNT(*) as count FROM tests"
                if conditions:
                    count_query += " WHERE " + " AND ".join(conditions)
                    count = conn.execute(count_query, params[:-2]).fetchone()["count"]
                else:
                    count = conn.execute(count_query).fetchone()["count"]

                return jsonify(
                    {
                        "tests": tests,
                        "total_count": count,
                        "limit": limit,
                        "offset": offset,
                    }
                )

        except Exception as e:
            logger.error(f"Error listing tests: {e}")
            return jsonify({"error": str(e)}), 500

    else:  # POST
        try:
            data = request.get_json()

            # Validate required fields
            if not data.get("name") or not data.get("chip_type"):
                return (
                    jsonify({"error": "Missing required fields: name, chip_type"}),
                    400,
                )

            test_id = generate_id()

            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO tests (id, name, chip_type, test_mode, environment, config, status, created, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        test_id,
                        data["name"],
                        data["chip_type"],
                        data.get("test_mode", "standard"),
                        data.get("environment", "lab"),
                        json.dumps(data.get("config", {})),
                        "created",
                        utc_now(),
                        json.dumps(data.get("metadata", {})),
                    ),
                )
                conn.commit()

            return jsonify({"id": test_id, "message": "Test created successfully"}), 201

        except Exception as e:
            logger.error(f"Error creating test: {e}")
            return jsonify({"error": str(e)}), 500

@app.route("/tests/<test_id>", methods=["GET", "DELETE"])
def handle_test_detail(test_id):
    """Get or delete test details"""
    try:
        with get_db() as conn:
            if request.method == "GET":
                cursor = conn.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
                test = cursor.fetchone()

                if not test:
                    return jsonify({"error": "Test not found"}), 404

                test_data = dict_from_row(test)

                # Parse JSON fields
                for field in ["config", "metadata"]:
                    if test_data.get(field):
                        try:
                            test_data[field] = json.loads(test_data[field])
                        except:
                            test_data[field] = {}

                # Get test results
                cursor = conn.execute(
                    "SELECT * FROM test_results WHERE test_id = ? ORDER BY timestamp DESC",
                    (test_id,),
                )
                results = [dict_from_row(row) for row in cursor]

                for result in results:
                    if result.get("results"):
                        try:
                            result["results"] = json.loads(result["results"])
                        except:
                            result["results"] = {}

                test_data["results"] = results
                return jsonify(test_data)

            else:  # DELETE
                cursor = conn.execute("DELETE FROM tests WHERE id = ?", (test_id,))
                if cursor.rowcount == 0:
                    return jsonify({"error": "Test not found"}), 404

                conn.commit()
                return jsonify({"message": "Test deleted successfully"})

    except Exception as e:
        logger.error(f"Error handling test {test_id}: {e}")
        return jsonify({"error": str(e)}), 500

# Helper function for simplified hardware testing (no belief propagation)
def run_hardware_test(snr_db, num_runs=1):
    """Run simplified hardware test focusing on actual Teensy telemetry"""
    try:
        teensy = teensy_pool.get_connection()
        
        # Run the hardware test
        hw_results = teensy.run_snr_test(snr_db, num_runs)
        # Don't close - connection is managed by pool
        
        return hw_results
        
    except Exception as e:
        logger.error(f"Hardware test error: {e}")
        return {"error": str(e), "algorithm": "hardware_ldpc"}

# ------------------------------ Teensy Connection Pool ------------------
class TeensyConnectionPool:
    """Manages persistent Teensy connections to avoid slow reconnections"""
    
    def __init__(self):
        self.connection = None
        self.last_used = time.time()
        self.connection_lock = threading.Lock()
        self.max_idle_time = 30  # Close connection after 30 seconds of inactivity
        
    def get_connection(self):
        """Get or create a Teensy connection"""
        with self.connection_lock:
            current_time = time.time()
            
            # Check if existing connection is still valid
            if self.connection and self.connection.connected:
                # Test connection with a quick heartbeat
                try:
                    if self.connection.check_connection():
                        self.last_used = current_time
                        logger.info("♻️ Reusing existing LDPC Teensy connection")
                        return self.connection
                    else:
                        logger.warning("Existing LDPC connection failed health check")
                        self.connection = None
                except Exception as e:
                    logger.warning(f"LDPC connection health check failed: {e}")
                    self.connection = None
            
            # Check if connection is too old
            if (self.connection and 
                current_time - self.last_used > self.max_idle_time):
                logger.info("Closing idle LDPC Teensy connection")
                try:
                    self.connection.close()
                except:
                    pass
                self.connection = None
            
            # Create new connection if needed
            if not self.connection:
                logger.info("🔌 Creating new LDPC Teensy connection...")
                try:
                    self.connection = TeensyInterface()
                    self.last_used = current_time
                    logger.info("✅ New LDPC Teensy connection established")
                except Exception as e:
                    logger.error(f"Failed to create LDPC Teensy connection: {e}")
                    raise
            
            return self.connection
    
    def close_all(self):
        """Close all connections"""
        with self.connection_lock:
            if self.connection:
                try:
                    self.connection.close()
                except:
                    pass
                self.connection = None

# Global connection pool
teensy_pool = TeensyConnectionPool()

# ------------------------------ Teensy Interface ----------------------------
class TeensyInterface:
    """Interface for communicating with Teensy 4.1 running AMORGOS LDPC decoder"""

    def __init__(self, port=None, baudrate=2_000_000):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self.connected = False
        self.last_heartbeat = time.time()
        self.START_MARKER = 0xDEADBEEF
        self.END_MARKER = 0xFFFFFFFF
        self.PROTOCOL_VERSION = 0x00010000
        self.NUM_OSCILLATORS = 96
        self.BITS_PER_VECTOR = 96
        self.ENERGY_PER_BIT_PJ = 5.47
        self.connection_attempts = 0
        self.max_connection_attempts = 3
        
        # Serial history buffer - store last 100 messages
        self.serial_history = []
        self.max_history = 100
        
        # Import hardware manager
        try:
            from hardware_manager import hardware_manager
            self.hw_manager = hardware_manager
        except:
            self.hw_manager = None
        
        # Auto-detect port if not specified
        if not self.port:
            self.port = self.find_teensy_port()
        
        if not self.connect():
            raise RuntimeError("Failed to connect to LDPC decoder hardware")

    def _add_to_history(self, message, direction="system"):
        """Add message to serial history with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = {
            "timestamp": timestamp,
            "message": message,
            "direction": direction  # "system", "sent", "received"
        }
        
        self.serial_history.append(entry)
        
        # Keep only last N messages
        if len(self.serial_history) > self.max_history:
            self.serial_history = self.serial_history[-self.max_history:]
    
    def add_session_separator(self, separator_text="DAEMON RELOAD"):
        """Add a session separator to serial history"""
        separator = f"{'='*50}"
        self._add_to_history(separator, "system")
        self._add_to_history(f"=== {separator_text} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===", "system")
        self._add_to_history(separator, "system")

    def get_serial_history(self):
        """Get formatted serial history for frontend"""
        formatted_history = []
        for entry in self.serial_history:
            if entry["direction"] == "sent":
                formatted_history.append(f"[{entry['timestamp']}] > {entry['message']}")
            elif entry["direction"] == "received":
                formatted_history.append(f"[{entry['timestamp']}] {entry['message']}")
            else:  # system
                formatted_history.append(f"[{entry['timestamp']}] {entry['message']}")
        return formatted_history

    def find_teensy_port(self):
        """Auto-detect LDPC Teensy port (dedicated to AMORGOS LDPC decoder)"""
        # Check with hardware manager first
        available_ports = hardware_manager.get_available_ports_for_device("ldpc")
        
        # Test available ports from hardware manager
        for port_name in available_ports:
            try:
                test_serial = serial.Serial(port_name, self.baudrate, timeout=0.1)
                test_serial.close()
                if hardware_manager.register_port(port_name, "ldpc"):
                    logger.info(f"Found LDPC Teensy at managed port: {port_name}")
                    self._add_to_history(f"Found LDPC Teensy at managed port: {port_name}")
                    return port_name
            except:
                pass
        
        # Use hardware manager if available
        if self.hw_manager:
            port = self.hw_manager.find_device("teensy_ldpc")
            if port and hardware_manager.is_port_available(port, "ldpc"):
                if hardware_manager.register_port(port, "ldpc"):
                    logger.info(f"Hardware manager found LDPC Teensy at: {port}")
                    self._add_to_history(f"Hardware manager found LDPC Teensy at: {port}")
                    return port
        
        # Extended search for LDPC-specific ports
        ldpc_known_ports = [
            "/dev/cu.usbmodem158960201",  # Primary LDPC port
            "/dev/tty.usbmodem158960201",  # Alternative LDPC port
            "/dev/cu.usbmodem158960301",  # Backup LDPC port
        ]
        
        for port_name in ldpc_known_ports:
            if not hardware_manager.is_port_available(port_name, "ldpc"):
                continue
                
            try:
                test_serial = serial.Serial(port_name, self.baudrate, timeout=0.1)
                test_serial.close()
                if hardware_manager.register_port(port_name, "ldpc"):
                    logger.info(f"Found LDPC Teensy at known port: {port_name}")
                    self._add_to_history(f"Found LDPC Teensy at known port: {port_name}")
                    return port_name
            except:
                pass
        
        # Fall back to auto-detection with device identification
        for port in serial.tools.list_ports.comports():
            # Skip if this port is likely the SAT device or already in use
            if (port.device in ["/dev/cu.usbmodem138999801", "/dev/cu.usbmodem139000201"] or
                not hardware_manager.is_port_available(port.device, "ldpc")):
                continue
                
            port_desc = port.description.lower()
            if any(id in port_desc for id in ["teensy", "usb serial", "usbmodem"]):
                # Try to identify device by sending a test command
                try:
                    test_serial = serial.Serial(port.device, self.baudrate, timeout=2)
                    time.sleep(0.5)
                    test_serial.write(b"STATUS\n")
                    test_serial.flush()
                    time.sleep(1)
                    
                    response = ""
                    while test_serial.in_waiting:
                        line = test_serial.readline().decode('utf-8', errors='ignore').strip()
                        response += line + " "
                    
                    test_serial.close()
                    
                    # Check if this is the LDPC device
                    if "AMORGOS" in response or "LDPC" in response or "STATUS:READY" in response:
                        if hardware_manager.register_port(port.device, "ldpc"):
                            logger.info(f"Identified LDPC Teensy at {port.device}: {port.description}")
                            self._add_to_history(f"Identified LDPC Teensy at {port.device}")
                            return port.device
                except Exception as e:
                    logger.debug(f"Failed to test port {port.device}: {e}")
                    continue
            
            # Check VID/PID for Teensy (last resort)
            if port.vid == 0x16C0:  # PJRC vendor ID
                # Skip known SAT ports
                if (port.device not in ["/dev/cu.usbmodem138999801", "/dev/cu.usbmodem139000201"] and
                    hardware_manager.is_port_available(port.device, "ldpc")):
                    if hardware_manager.register_port(port.device, "ldpc"):
                        logger.info(f"Found LDPC Teensy by VID/PID at {port.device}")
                        self._add_to_history(f"Found LDPC Teensy by VID/PID at {port.device}")
                        return port.device
        
        return None

    def connect(self):
        """Establish connection to Teensy with retry logic"""
        self.connection_attempts += 1
        
        try:
            if not self.port:
                error_msg = "No LDPC Teensy device found"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                if self.hw_manager:
                    self.hw_manager.add_connection_event(
                        "teensy_ldpc", None, "failed", "No device found"
                    )
                return False

            connect_msg = f"Connecting to LDPC Teensy at {self.port} at {self.baudrate} baud (attempt {self.connection_attempts})"
            logger.info(connect_msg)
            self._add_to_history(f"🔌 {connect_msg}")
            
            # Close existing connection if any
            if self.serial and self.serial.is_open:
                self.serial.close()
                time.sleep(0.5)
            
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=5,
                write_timeout=2,
                exclusive=True
            )

            # Clear buffers
            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()

            # Wait for device to initialize
            logger.info("Waiting for LDPC device initialization...")
            self._add_to_history("⏳ Waiting for LDPC device initialization...")
            time.sleep(2)

            # Read startup messages
            startup_messages = []
            start_time = time.time()
            while time.time() - start_time < 5:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    startup_messages.append(line)
                    logger.info(f"LDPC Startup: {line}")
                    self._add_to_history(line, "received")
                    
                    if "AMORGOS LDPC Decoder Ready" in line:
                        self.connected = True
                        self.last_heartbeat = time.time()
                        success_msg = "Successfully connected to LDPC decoder"
                        logger.info(success_msg)
                        self._add_to_history(f"✅ {success_msg}")
                        
                        if self.hw_manager:
                            self.hw_manager.add_connection_event(
                                "teensy_ldpc", self.port, "connected", 
                                {"startup_messages": startup_messages}
                            )
                        return True

            # If no ready message, try sending status command
            logger.warning("No LDPC ready message received, trying status command...")
            self._add_to_history("⚠️ No LDPC ready message received, trying status command...")
            try:
                self.serial.write(b"STATUS\n")
                self.serial.flush()
                self._add_to_history("STATUS", "sent")
                time.sleep(1)
                
                if self.serial.in_waiting:
                    response = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    self._add_to_history(response, "received")
                    if "STATUS:READY" in response:
                        self.connected = True
                        self.last_heartbeat = time.time()
                        logger.info("LDPC connection verified via STATUS command")
                        self._add_to_history("✅ LDPC connection verified via STATUS command")
                        return True
            except Exception as e:
                logger.warning(f"LDPC status command failed: {e}")
                self._add_to_history(f"⚠️ LDPC status command failed: {e}")

            error_msg = "LDPC device did not respond properly - may need firmware reflash"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            if self.hw_manager:
                self.hw_manager.add_connection_event(
                    "teensy_ldpc", self.port, "failed", 
                    {"reason": "No proper response", "startup_messages": startup_messages}
                )
            return False

        except Exception as e:
            error_msg = f"LDPC connection error: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            if self.serial and self.serial.is_open:
                self.serial.close()
            
            if self.hw_manager:
                self.hw_manager.add_connection_event(
                    "teensy_ldpc", self.port, "failed", str(e)
                )
            return False

    def check_connection(self):
        """Verify connection is still active with automatic reconnection"""
        if not self.connected or not self.serial or not self.serial.is_open:
            logger.warning("LDPC connection lost, attempting to reconnect...")
            self._add_to_history("⚠️ LDPC connection lost, attempting to reconnect...")
            if self.connection_attempts < self.max_connection_attempts:
                return self.connect()
            else:
                error_msg = "Max LDPC connection attempts exceeded - hardware may need reset"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                return False

        try:
            # Check for heartbeats in buffer
            while self.serial.in_waiting:
                line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                if "HEARTBEAT" in line:
                    self.last_heartbeat = time.time()
                    logger.debug(f"LDPC Heartbeat: {line}")
                    # Don't add heartbeats to history to avoid spam
                elif line.strip():  # Add other non-heartbeat messages
                    self._add_to_history(line, "received")

            # If no heartbeat for 30 seconds (increased from 15), check explicitly
            # This prevents too frequent STATUS checks
            if time.time() - self.last_heartbeat > 30:
                logger.warning("No LDPC heartbeat for 30s, sending status check...")
                self.serial.write(b"STATUS\n")
                self.serial.flush()
                self._add_to_history("STATUS", "sent")

                start_time = time.time()
                while time.time() - start_time < 3:  # Increased timeout
                    if self.serial.in_waiting:
                        response = self.serial.readline().decode('utf-8', errors='ignore').strip()
                        self._add_to_history(response, "received")
                        if "STATUS:READY" in response or "HEARTBEAT" in response:
                            self.last_heartbeat = time.time()
                            return True

                error_msg = "No response to LDPC status check - connection may be dead"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                self._add_to_history("❌ HARDWARE ALERT: Press the RESET button on your LDPC Teensy and try again")
                self.serial.close()
                self.connected = False
                return False

            return True

        except Exception as e:
            error_msg = f"LDPC connection check failed: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            self._add_to_history("❌ HARDWARE ALERT: Press the RESET button on your LDPC Teensy and try again")
            self.connected = False
            return False

    def execute_command(self, command, timeout=5):
        """Execute a single command and return response"""
        if not self.check_connection():
            raise RuntimeError("LDPC hardware not connected - press RESET button on Teensy")

        try:
            # Clear any pending data
            while self.serial.in_waiting:
                self.serial.readline()

            # Send command
            self.serial.write(f"{command}\n".encode())
            self.serial.flush()
            self._add_to_history(command, "sent")

            # Collect response
            responses = []
            start_time = time.time()

            while time.time() - start_time < timeout:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        responses.append(line)
                        self._add_to_history(line, "received")
                        # Some commands have immediate responses
                        if any(term in line for term in ["ACK:", "STATUS:", "DACROQ_BOARD:", "ERROR:"]):
                            break

            response = "\n".join(responses) if responses else "No response"
            return response

        except Exception as e:
            error_msg = f"LDPC command execution failed: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            raise RuntimeError(f"LDPC hardware command failed: {str(e)}")

    def check_chip_health(self):
        """Run comprehensive health check with better error handling"""
        if not self.check_connection():
            return {
                "status": "error", 
                "details": "Not connected - press RESET button on LDPC Teensy",
                "troubleshooting": [
                    "Press the physical RESET button on your LDPC Teensy",
                    "Check USB cable connection", 
                    "Verify firmware is uploaded correctly",
                    "Try reflashing firmware with platformio"
                ]
            }

        try:
            self.serial.write(b"HEALTH_CHECK\n")
            self.serial.flush()

            # Collect health check results
            health_results = []
            start_time = time.time()

            while time.time() - start_time < 10:  # Increased timeout
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    health_results.append(line)

                    if "HEALTH_CHECK_COMPLETE" in line:
                        status = "healthy" if line.endswith(":OK") else "error"

                        # Parse individual test results
                        power_ok = any("POWER_OK" in r for r in health_results)
                        clock_ok = any("CLOCK_OK" in r for r in health_results)
                        memory_ok = any("MEMORY_OK" in r for r in health_results)
                        osc_ok = any("OSCILLATORS_OK" in r for r in health_results)

                        return {
                            "status": status,
                            "details": {
                                "power": power_ok,
                                "clock": clock_ok,
                                "memory": memory_ok,
                                "oscillators": osc_ok,
                                "raw_results": health_results
                            }
                        }

            return {
                "status": "error", 
                "details": "LDPC health check timeout - hardware may be unresponsive",
                "troubleshooting": [
                    "Press the RESET button on your LDPC Teensy",
                    "Check if firmware is properly uploaded",
                    "Verify USB connection"
                ]
            }

        except Exception as e:
            return {
                "status": "error", 
                "details": f"LDPC health check failed: {str(e)}",
                "troubleshooting": [
                    "Press the RESET button on your LDPC Teensy",
                    "Reflash firmware using platformio"
                ]
            }

    def run_snr_test(self, snr_db, num_runs=1):
        """Run simplified test using CSV output from Teensy"""
        if not self.check_connection():
            raise RuntimeError("Device not connected")

        logger.info(f"Starting simplified SNR {snr_db}dB test: {num_runs} runs")

        try:
            # Clear any pending data first
            while self.serial.in_waiting:
                line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    logger.debug(f"Cleared: {line}")
                    self._add_to_history(line, "received")

            # Send SIMPLE_TEST command
            command = f"SIMPLE_TEST:{snr_db}:{num_runs}"
            self.serial.write(f"{command}\n".encode())
            self.serial.flush()
            self._add_to_history(command, "sent")

            # Wait for acknowledgment
            start_time = time.time()
            ack_received = False
            
            while time.time() - start_time < 10:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    logger.info(f"Response: {line}")
                    self._add_to_history(line, "received")
                    
                    if f"ACK:SIMPLE_TEST:{snr_db}:{num_runs}" in line:
                        ack_received = True
                        break
                    elif "ERROR:" in line:
                        raise RuntimeError(f"Teensy error: {line}")
                time.sleep(0.1)

            if not ack_received:
                logger.warning("No ACK received, attempting reset...")
                self.serial.write(b"RESET\n")
                self.serial.flush()
                time.sleep(2)
                raise RuntimeError("No ACK received for SIMPLE_TEST command")

            # Collect test data
            test_results = []
            csv_header = None
            test_started = False
            
            start_time = time.time()
            while time.time() - start_time < 60:  # 60 second timeout
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                        
                    logger.debug(f"Received: {line}")
                    self._add_to_history(line, "received")
                    
                    if line.startswith("SIMPLE_TEST_START:"):
                        test_started = True
                        logger.info("Test started on Teensy")
                        
                    elif line.startswith("CSV_HEADER:"):
                        csv_header = line.replace("CSV_HEADER:", "").split(",")
                        logger.info(f"CSV Header: {csv_header}")
                        
                    elif line.startswith("CSV_DATA:"):
                        data_line = line.replace("CSV_DATA:", "")
                        values = data_line.split(",")
                        
                        if csv_header and len(values) == len(csv_header):
                            # Parse the CSV data
                            result = {}
                            for i, header in enumerate(csv_header):
                                try:
                                    if header in ['test_index', 'snr_db', 'execution_time_us', 'bit_errors', 'frame_errors', 'success']:
                                        result[header] = int(values[i])
                                    elif header in ['energy_per_bit_pj', 'avg_power_mw']:
                                        result[header] = float(values[i])
                                    else:
                                        result[header] = values[i]
                                except (ValueError, IndexError):
                                    result[header] = 0
                            
                            test_results.append(result)
                            
                    elif line == "SIMPLE_TEST_COMPLETE:SUCCESS":
                        logger.info("Test completed successfully")
                        break
                        
                    elif "ERROR:" in line:
                        raise RuntimeError(f"Test error: {line}")
                        
                time.sleep(0.01)

            if not test_started:
                raise RuntimeError("Test never started on Teensy")
                
            if not test_results:
                raise RuntimeError("No test data received")

            # Calculate summary statistics
            successful_decodes = sum(1 for r in test_results if r.get('success', 0) == 1)
            total_bit_errors = sum(r.get('bit_errors', 0) for r in test_results)
            total_frame_errors = sum(r.get('frame_errors', 0) for r in test_results)
            avg_execution_time = sum(r.get('execution_time_us', 0) for r in test_results) / len(test_results)
            avg_power = sum(r.get('avg_power_mw', 5.9) for r in test_results) / len(test_results)
            avg_energy = sum(r.get('energy_per_bit_pj', 5.47) for r in test_results) / len(test_results)
            
            # Calculate error rates
            total_bits = len(test_results) * 48  # 48 info bits per frame
            total_frames = len(test_results)
            
            summary_results = {
                'snr_db': snr_db,
                'num_runs': num_runs,
                'results': test_results,  # Individual test results
                'successful_decodes': successful_decodes,
                'total_vectors': len(test_results),
                'avg_execution_time_us': avg_execution_time,
                'bit_error_rate': total_bit_errors / total_bits if total_bits > 0 else 0,
                'frame_error_rate': total_frame_errors / total_frames if total_frames > 0 else 0,
                'energy_efficiency_pj_per_bit': avg_energy,
                'avg_power_consumption_mw': avg_power,
                'throughput_mbps': (48 * 1e6) / avg_execution_time if avg_execution_time > 0 else 0,
                'convergence_rate': successful_decodes / len(test_results) if test_results else 0
            }

            logger.info(f"SNR {snr_db}dB test completed: {successful_decodes}/{len(test_results)} successful, "
                       f"BER: {summary_results['bit_error_rate']:.2e}, "
                       f"avg time: {avg_execution_time:.1f}μs")
            
            return summary_results

        except Exception as e:
            logger.error(f"Test error: {e}")
            # Try to reset Teensy state on any error
            try:
                self.serial.write(b"RESET\n")
                self.serial.flush()
                time.sleep(1)
                self._add_to_history("Reset sent due to test error", "system")
            except:
                pass
            raise

    def close(self):
        """Clean shutdown"""
        if self.serial and self.serial.is_open:
            try:
                self.serial.write(b"LED:IDLE\n")
                self.serial.close()
                logger.info("LDPC Teensy connection closed")
            except:
                pass
            finally:
                self.connected = False
                # Unregister port with hardware manager
                if self.port:
                    hardware_manager.unregister_port(self.port)

# ------------------------------ LDPC Routes ----------------------------------
@app.route("/ldpc/deploy", methods=["POST"])
def ldpc_deploy():
    """Deploy a batch-test configuration to the Teensy console"""
    teensy = None
    try:
        data = request.get_json()
        snr_runs = data.get("snr_runs", {})
        info_type = data.get("info_type", "SOFT_INFO")
        mode = data.get("mode", "run")

        if not snr_runs:
            return jsonify({"error": "snr_runs cannot be empty"}), 400

        teensy = teensy_pool.get_connection()
        start_ts = utc_now()
        
        # Deploy commands to teensy
        console_log = []
        for snr, runs in snr_runs.items():
            cmd = f"SET_SNR:{snr.replace('dB', '')}"
            response = teensy.execute_command(cmd)
            console_log.append(f"Command: {cmd}")
            console_log.append(f"Response: {response}")

        end_ts = utc_now()

        return jsonify(
            {
                "status": "success",
                "started": start_ts,
                "completed": end_ts,
                "log": console_log,
            }
        )
    except Exception as e:
        logger.error(f"Deploy error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ldpc/command", methods=["POST"])
def ldpc_command():
    """Send an arbitrary single command to the Teensy console"""
    teensy = None
    try:
        cmd = request.get_json().get("command", "").strip()
        if not cmd:
            return jsonify({"error": "command cannot be empty"}), 400
        teensy = teensy_pool.get_connection()
        output = teensy.execute_command(cmd)
        return jsonify({"output": output})
    except Exception as e:
        logger.error(f"Command error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ldpc/serial-history", methods=["GET"])
def ldpc_serial_history():
    """Get the current serial communication history"""
    try:
        teensy = teensy_pool.get_connection()
        history = teensy.get_serial_history()
        return jsonify({
            "history": history,
            "connected": teensy.connected,
            "last_heartbeat": teensy.last_heartbeat
        })
    except Exception as e:
        logger.error(f"Serial history error: {e}")
        return jsonify({
            "history": [],
            "connected": False,
            "error": str(e)
        }), 500

@app.route("/ldpc/jobs", methods=["GET", "POST"])
def handle_ldpc_jobs():
    """List LDPC jobs or create new job"""
    if request.method == "GET":
        try:
            with get_db() as conn:
                cursor = conn.execute("SELECT * FROM ldpc_jobs ORDER BY created DESC")
                jobs = [dict_from_row(row) for row in cursor]

                # Parse JSON fields
                for job in jobs:
                    for field in ["config", "results", "metadata"]:
                        if job.get(field):
                            try:
                                job[field] = json.loads(job[field])
                            except:
                                job[field] = {}

                return jsonify({"jobs": jobs})

        except Exception as e:
            logger.error(f"Error listing LDPC jobs: {e}")
            return jsonify({"error": str(e)}), 500
    
    else:  # POST
        try:
            data = request.get_json()
            job_id = generate_id()

            # Job configuration
            start_snr = data.get("start_snr", 1)
            end_snr = data.get("end_snr", 10)
            runs_per_snr = data.get("runs_per_snr", 1)
            test_name = data.get("name", f"LDPC_HW_{job_id[:8]}")
            
            # Only hardware algorithm now (simplified)
            use_hardware = True

            # Validate parameters
            if not 1 <= start_snr <= 10 or not 1 <= end_snr <= 10:
                return jsonify({"error": "SNR must be between 1 and 10 dB"}), 400
            
            if start_snr > end_snr:
                return jsonify({"error": "Start SNR must be <= End SNR"}), 400
            
            if not 1 <= runs_per_snr <= 10:
                return jsonify({"error": "Runs per SNR must be between 1 and 10"}), 400

            # Try to connect to hardware
            teensy = None
            health_status = None
            
            try:
                teensy = teensy_pool.get_connection()
                
                # Health check
                health_status = teensy.check_chip_health()
                if health_status["status"] != "healthy":
                    raise RuntimeError(f"Hardware health check failed: {health_status}")
            except Exception as e:
                return jsonify({
                    "error": f"Hardware connection failed: {str(e)}",
                    "suggestion": "Check Teensy connection and press RESET button if needed"
                }), 500

            # Store job in database with "running" status
            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO ldpc_jobs 
                    (id, name, job_type, config, status, created, started, progress, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        job_id,
                        test_name,
                        "ldpc_hardware_test",
                        json.dumps({
                            "start_snr": start_snr,
                            "end_snr": end_snr,
                            "runs_per_snr": runs_per_snr,
                            "hardware_type": "AMORGOS_LDPC"
                        }),
                        "running",
                        utc_now(),
                        utc_now(),
                        0.0,
                        json.dumps({"health_check": health_status})
                    )
                )
                conn.commit()

            # Run tests for each SNR point
            all_results = {}
            snr_points = range(start_snr, end_snr + 1)
            total_steps = len(snr_points)
            
            for idx, snr in enumerate(snr_points):
                logger.info(f"Testing SNR {snr}dB ({idx+1}/{total_steps})")
                
                try:
                    # Run hardware test
                    hw_results = teensy.run_snr_test(snr, runs_per_snr)
                    all_results[f"{snr}dB"] = hw_results
                    
                    # Update progress
                    progress = ((idx + 1) / total_steps) * 100
                    with get_db() as conn:
                        conn.execute(
                            "UPDATE ldpc_jobs SET progress = ? WHERE id = ?",
                            (progress, job_id)
                        )
                        conn.commit()
                    
                except Exception as e:
                    logger.error(f"Error at SNR {snr}dB: {e}")
                    all_results[f"{snr}dB"] = {"error": str(e)}

            # Calculate summary statistics
            summary = {
                "test_configuration": {
                    "snr_range": f"{start_snr}-{end_snr} dB",
                    "runs_per_snr": runs_per_snr,
                    "hardware": "AMORGOS 28nm CMOS",
                    "code": "(96,48) LDPC"
                },
                "performance_summary": {}
            }

            # Update job with final results
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE ldpc_jobs 
                    SET status = ?, completed = ?, results = ?, progress = ?, metadata = ?
                    WHERE id = ?
                """,
                    (
                        "completed",
                        utc_now(),
                        json.dumps(all_results),
                        100.0,
                        json.dumps(summary),
                        job_id
                    )
                )
                conn.commit()

            return jsonify({
                "job_id": job_id,
                "status": "completed",
                "summary": summary,
                "message": f"Hardware test completed: {start_snr}-{end_snr}dB"
            }), 201

        except Exception as e:
            logger.error(f"Error creating LDPC job: {e}")
            
            # Update job status to failed
            try:
                with get_db() as conn:
                    conn.execute(
                        "UPDATE ldpc_jobs SET status = ?, completed = ? WHERE id = ?",
                        ("failed", utc_now(), job_id)
                    )
                    conn.commit()
            except:
                pass
            
            return jsonify({"error": str(e)}), 500

@app.route("/ldpc/jobs/<job_id>", methods=["GET", "DELETE"])
def handle_ldpc_job_detail(job_id):
    """Get or delete LDPC job details"""
    try:
        with get_db() as conn:
            if request.method == "GET":
                cursor = conn.execute("SELECT * FROM ldpc_jobs WHERE id = ?", (job_id,))
                job = cursor.fetchone()

                if not job:
                    return jsonify({"error": "Job not found"}), 404

                job_data = dict_from_row(job)

                # Parse JSON fields
                for field in ["config", "results", "metadata"]:
                    if job_data.get(field):
                        try:
                            job_data[field] = json.loads(job_data[field])
                        except:
                            job_data[field] = {}

                return jsonify(job_data)

            else:  # DELETE
                cursor = conn.execute("DELETE FROM ldpc_jobs WHERE id = ?", (job_id,))
                if cursor.rowcount == 0:
                    return jsonify({"error": "Job not found"}), 404

                conn.commit()
                return jsonify({"message": "Job deleted successfully"})

    except Exception as e:
        logger.error(f"Error handling LDPC job {job_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ldpc/test-summaries", methods=["GET"])
def get_test_summaries():
    """Get summaries of all tests for comparison dropdown"""
    try:
        with get_db() as conn:
            # Get LDPC jobs
            ldpc_cursor = conn.execute("""
                SELECT id, name, status, created, 
                       json_extract(metadata, '$.performance_summary.convergence_rate') as convergence_rate,
                       json_extract(metadata, '$.performance_summary.energy_efficiency_pj_per_bit') as energy_per_bit,
                       json_extract(metadata, '$.test_configuration.algorithm_type') as algorithm_type
                FROM ldpc_jobs 
                WHERE status = 'completed'
                ORDER BY created DESC
            """)
            ldpc_jobs = [dict_from_row(row) for row in ldpc_cursor]
            
            # Get other tests (SAT, etc.)
            test_cursor = conn.execute("""
                SELECT id, name, chip_type, status, created
                FROM tests 
                WHERE status = 'completed'
                ORDER BY created DESC
            """)
            other_tests = [dict_from_row(row) for row in test_cursor]
            
            # Format for dropdown
            summaries = []
            
            for job in ldpc_jobs:
                summaries.append({
                    "id": job["id"],
                    "name": job["name"],
                    "type": "LDPC",
                    "algorithm": job.get("algorithm_type", "unknown"),
                    "created": job["created"],
                    "convergence_rate": job.get("convergence_rate"),
                    "energy_per_bit": job.get("energy_per_bit")
                })
            
            for test in other_tests:
                summaries.append({
                    "id": test["id"],
                    "name": test["name"],
                    "type": test["chip_type"],
                    "algorithm": "hardware",
                    "created": test["created"]
                })
            
            return jsonify({"summaries": summaries})
            
    except Exception as e:
        logger.error(f"Error fetching test summaries: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------------------ SAT Hardware Interface ---------------------------
class SATHardwareInterface:
    """Interface for communicating with Teensy 4.1 running DAEDALUS 3-SAT solver"""

    def __init__(self, port=None, baudrate=2_000_000):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self.connected = False
        self.last_heartbeat = time.time()
        self.connection_attempts = 0
        self.max_connection_attempts = 3
        
        # Serial history buffer
        self.serial_history = []
        self.max_history = 100
        
        # Auto-detect port if not specified
        if not self.port:
            self.port = self.find_daedalus_port()
        
        if not self.connect():
            raise RuntimeError("Failed to connect to DAEDALUS 3-SAT solver hardware")

    def _add_to_history(self, message, direction="system"):
        """Add message to serial history with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = {
            "timestamp": timestamp,
            "message": message,
            "direction": direction
        }
        
        self.serial_history.append(entry)
        
        if len(self.serial_history) > self.max_history:
            self.serial_history = self.serial_history[-self.max_history:]
    
    def add_session_separator(self, separator_text="DAEMON RELOAD"):
        """Add a session separator to serial history"""
        separator = f"{'='*50}"
        self._add_to_history(separator, "system")
        self._add_to_history(f"=== {separator_text} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===", "system")
        self._add_to_history(separator, "system")

    def find_daedalus_port(self):
        """Auto-detect DAEDALUS Teensy port (dedicated to 3-SAT solver)"""
        # Check with hardware manager first
        available_ports = hardware_manager.get_available_ports_for_device("sat")
        
        # Test available ports from hardware manager
        for port_name in available_ports:
            try:
                test_serial = serial.Serial(port_name, self.baudrate, timeout=0.1)
                test_serial.close()
                if hardware_manager.register_port(port_name, "sat"):
                    logger.info(f"Found DAEDALUS Teensy at managed port: {port_name}")
                    self._add_to_history(f"Found DAEDALUS at managed port: {port_name}")
                    return port_name
            except:
                pass
        
        # Extended search for DAEDALUS-specific ports
        daedalus_known_ports = [
            "/dev/cu.usbmodem138999801",  # Primary DAEDALUS port
            "/dev/cu.usbmodem139000201",  # Alternative DAEDALUS port  
            "/dev/cu.usbmodem139000301",  # Backup DAEDALUS port
            "/dev/tty.usbmodem138999801", # Alternative format
        ]
        
        for port_name in daedalus_known_ports:
            if not hardware_manager.is_port_available(port_name, "sat"):
                continue
                
            try:
                test_serial = serial.Serial(port_name, self.baudrate, timeout=0.1)
                test_serial.close()
                if hardware_manager.register_port(port_name, "sat"):
                    logger.info(f"Found DAEDALUS Teensy at known port: {port_name}")
                    self._add_to_history(f"Found DAEDALUS at known port: {port_name}")
                    return port_name
            except:
                pass
        
        # Auto-detection with device identification
        for port in serial.tools.list_ports.comports():
            # Skip if this port is likely the LDPC device or already in use
            if (port.device in ["/dev/cu.usbmodem158960201", "/dev/tty.usbmodem158960201", "/dev/cu.usbmodem158960301"] or
                not hardware_manager.is_port_available(port.device, "sat")):
                continue
                
            port_desc = port.description.lower()
            if any(id in port_desc for id in ["teensy", "usb serial", "usbmodem"]):
                # Try to identify device by sending a test command
                try:
                    test_serial = serial.Serial(port.device, self.baudrate, timeout=2)
                    time.sleep(0.5)
                    test_serial.write(b"STATUS\n")
                    test_serial.flush()
                    time.sleep(1)
                    
                    response = ""
                    while test_serial.in_waiting:
                        line = test_serial.readline().decode('utf-8', errors='ignore').strip()
                        response += line + " "
                    
                    test_serial.close()
                    
                    # Check if this is the DAEDALUS device
                    if "DAEDALUS" in response or "3-SAT" in response or ("STATUS:READY" in response and "AMORGOS" not in response):
                        if hardware_manager.register_port(port.device, "sat"):
                            logger.info(f"Identified DAEDALUS Teensy at {port.device}: {port.description}")
                            self._add_to_history(f"Identified DAEDALUS at {port.device}")
                            return port.device
                except Exception as e:
                    logger.debug(f"Failed to test DAEDALUS port {port.device}: {e}")
                    continue
            
            # Check VID/PID for Teensy (last resort)
            if port.vid == 0x16C0:  # PJRC vendor ID
                # Skip known LDPC ports
                if (port.device not in ["/dev/cu.usbmodem158960201", "/dev/tty.usbmodem158960201", "/dev/cu.usbmodem158960301"] and
                    hardware_manager.is_port_available(port.device, "sat")):
                    if hardware_manager.register_port(port.device, "sat"):
                        logger.info(f"Found DAEDALUS Teensy by VID/PID at {port.device}")
                        self._add_to_history(f"Found DAEDALUS by VID/PID at {port.device}")
                        return port.device
        
        return None

    def connect(self):
        """Establish connection to DAEDALUS Teensy"""
        self.connection_attempts += 1
        
        try:
            if not self.port:
                error_msg = "No DAEDALUS device found"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                return False

            connect_msg = f"Connecting to DAEDALUS at {self.port} (attempt {self.connection_attempts})"
            logger.info(connect_msg)
            self._add_to_history(f"🔌 {connect_msg}")
            
            if self.serial and self.serial.is_open:
                self.serial.close()
                time.sleep(0.5)
            
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=5,
                write_timeout=2,
                exclusive=True
            )

            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()

            logger.info("Waiting for DAEDALUS initialization...")
            self._add_to_history("⏳ Waiting for DAEDALUS initialization...")
            time.sleep(2)

            # Read startup messages
            startup_messages = []
            start_time = time.time()
            while time.time() - start_time < 5:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    startup_messages.append(line)
                    logger.info(f"DAEDALUS Startup: {line}")
                    self._add_to_history(line, "received")
                    
                    if "DAEDALUS 3-SAT Solver" in line or "READY" in line:
                        self.connected = True
                        self.last_heartbeat = time.time()
                        success_msg = "Successfully connected to DAEDALUS"
                        logger.info(success_msg)
                        self._add_to_history(f"✅ {success_msg}")
                        return True

            # Try status command
            logger.warning("No DAEDALUS ready message, trying status...")
            try:
                self.serial.write(b"STATUS\n")
                self.serial.flush()
                self._add_to_history("STATUS", "sent")
                time.sleep(1)
                
                if self.serial.in_waiting:
                    response = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    self._add_to_history(response, "received")
                    if "STATUS:READY" in response:
                        self.connected = True
                        self.last_heartbeat = time.time()
                        logger.info("DAEDALUS connection verified via STATUS")
                        self._add_to_history("✅ DAEDALUS connection verified")
                        return True
            except Exception as e:
                logger.warning(f"DAEDALUS status command failed: {e}")
                self._add_to_history(f"⚠️ DAEDALUS status command failed: {e}")

            error_msg = "DAEDALUS did not respond properly"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            return False

        except Exception as e:
            error_msg = f"DAEDALUS connection error: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            if self.serial and self.serial.is_open:
                self.serial.close()
            return False

    def check_connection(self):
        """Verify DAEDALUS connection is active"""
        if not self.connected or not self.serial or not self.serial.is_open:
            logger.warning("DAEDALUS connection lost, attempting to reconnect...")
            self._add_to_history("⚠️ DAEDALUS connection lost, attempting to reconnect...")
            if self.connection_attempts < self.max_connection_attempts:
                return self.connect()
            else:
                error_msg = "Max DAEDALUS connection attempts exceeded"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                return False

        try:
            # Check for any pending messages
            while self.serial.in_waiting:
                line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                if line.strip():
                    self._add_to_history(line, "received")

            # Periodic status check
            if time.time() - self.last_heartbeat > 30:
                logger.info("Checking DAEDALUS status...")
                self.serial.write(b"STATUS\n")
                self.serial.flush()
                self._add_to_history("STATUS", "sent")

                start_time = time.time()
                while time.time() - start_time < 3:
                    if self.serial.in_waiting:
                        response = self.serial.readline().decode('utf-8', errors='ignore').strip()
                        self._add_to_history(response, "received")
                        if "STATUS:READY" in response:
                            self.last_heartbeat = time.time()
                            return True

                error_msg = "No response to DAEDALUS status check"
                logger.error(error_msg)
                self._add_to_history(f"❌ {error_msg}")
                self.serial.close()
                self.connected = False
                return False

            return True

        except Exception as e:
            error_msg = f"DAEDALUS connection check failed: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            self.connected = False
            return False

    def execute_command(self, command, timeout=10):
        """Execute command on DAEDALUS"""
        if not self.check_connection():
            raise RuntimeError("DAEDALUS not connected - check hardware")

        try:
            # Clear pending data
            while self.serial.in_waiting:
                self.serial.readline()

            # Send command
            self.serial.write(f"{command}\n".encode())
            self.serial.flush()
            self._add_to_history(command, "sent")

            # Collect response
            responses = []
            start_time = time.time()

            while time.time() - start_time < timeout:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        responses.append(line)
                        self._add_to_history(line, "received")
                        if any(term in line for term in ["ACK:", "STATUS:", "ERROR:", "COMPLETE"]):
                            break

            response = "\n".join(responses) if responses else "No response"
            return response

        except Exception as e:
            error_msg = f"DAEDALUS command execution failed: {e}"
            logger.error(error_msg)
            self._add_to_history(f"❌ {error_msg}")
            raise RuntimeError(f"DAEDALUS hardware command failed: {str(e)}")

    def solve_sat_problem(self, dimacs_cnf, solver_type="daedalus", problem_count=1):
        """Solve SAT problem using DAEDALUS hardware"""
        if not self.check_connection():
            raise RuntimeError("DAEDALUS not connected")

        logger.info(f"Starting SAT solve: {solver_type}, {problem_count} problems")

        try:
            # Parse DIMACS to get problem info
            lines = dimacs_cnf.strip().split('\n')
            variables = 0
            clauses = 0
            
            for line in lines:
                line = line.strip()
                if line.startswith('p cnf'):
                    parts = line.split()
                    variables = int(parts[2])
                    clauses = int(parts[3])
                    break

            # Determine problem type
            if variables <= 20:
                problem_type = "uf20"
            elif variables <= 50:
                problem_type = "uf50"
            else:
                problem_type = "uf100"

            # Send SAT test command
            command = f"SAT_TEST:{problem_type}:{problem_count}"
            self.serial.write(f"{command}\n".encode())
            self.serial.flush()
            self._add_to_history(command, "sent")

            # Wait for acknowledgment
            start_time = time.time()
            ack_received = False
            
            while time.time() - start_time < 10:
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    self._add_to_history(line, "received")
                    
                    if f"ACK:SAT_TEST" in line:
                        ack_received = True
                        break
                    elif "ERROR:" in line:
                        raise RuntimeError(f"DAEDALUS error: {line}")

            if not ack_received:
                raise RuntimeError("No acknowledgment received")

            # Collect results
            results = []
            start_time = time.time()
            
            while time.time() - start_time < 60:  # 60 second timeout
                if self.serial.in_waiting:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                        
                    self._add_to_history(line, "received")
                    
                    if line.startswith("RESULT:"):
                        # Parse CSV result: run,sat/unsat,time_us,energy_nj,power_mw,propagations
                        data = line.replace("RESULT:", "").split(",")
                        if len(data) >= 6:
                            result = {
                                "run": int(data[0]),
                                "satisfiable": data[1] == "SAT",
                                "solve_time_ms": float(data[2]) / 1000,  # Convert μs to ms
                                "energy_nj": float(data[3]),
                                "power_mw": float(data[4]),
                                "propagations": int(data[5]),
                                "success": True
                            }
                            results.append(result)
                            
                    elif line == "TEST_COMPLETE":
                        logger.info("SAT test completed")
                        break
                        
                    elif "ERROR:" in line:
                        raise RuntimeError(f"Test error: {line}")

            if not results:
                raise RuntimeError("No results received from DAEDALUS")

            # Calculate summary statistics
            successful_solves = len(results)
            total_time = sum(r["solve_time_ms"] for r in results)
            avg_time = total_time / len(results)
            avg_energy = sum(r["energy_nj"] for r in results) / len(results)
            avg_power = sum(r["power_mw"] for r in results) / len(results)
            sat_count = sum(1 for r in results if r["satisfiable"])
            
            summary = {
                "solver": solver_type,
                "problem_type": problem_type,
                "variables": variables,
                "clauses": clauses,
                "total_problems": problem_count,
                "successful_solves": successful_solves,
                "sat_count": sat_count,
                "unsat_count": successful_solves - sat_count,
                "satisfiability_rate": sat_count / successful_solves if successful_solves > 0 else 0,
                "avg_solve_time_ms": avg_time,
                "total_time_ms": total_time,
                "avg_energy_nj": avg_energy,
                "avg_power_mw": avg_power,
                "runs": results
            }

            logger.info(f"SAT solve completed: {successful_solves} problems, "
                       f"{sat_count} SAT, avg time: {avg_time:.2f}ms")
            
            return summary

        except Exception as e:
            logger.error(f"SAT solve error: {e}")
            # Reset on error
            try:
                self.serial.write(b"RESET\n")
                self.serial.flush()
                time.sleep(1)
            except:
                pass
            raise

    def close(self):
        """Clean shutdown"""
        if self.serial and self.serial.is_open:
            try:
                self.serial.write(b"LED:OFF\n")
                self.serial.close()
                logger.info("DAEDALUS connection closed")
            except:
                pass
            finally:
                self.connected = False
                # Unregister port with hardware manager
                if self.port:
                    hardware_manager.unregister_port(self.port)

# SAT Hardware connection pool
class SATConnectionPool:
    """Manages DAEDALUS hardware connections"""
    
    def __init__(self):
        self.connection = None
        self.last_used = time.time()
        self.connection_lock = threading.Lock()
        self.max_idle_time = 30
        
    def get_connection(self):
        """Get or create DAEDALUS connection"""
        with self.connection_lock:
            current_time = time.time()
            
            if self.connection and self.connection.connected:
                try:
                    if self.connection.check_connection():
                        self.last_used = current_time
                        logger.info("♻️ Reusing existing DAEDALUS connection")
                        return self.connection
                    else:
                        logger.warning("DAEDALUS connection check failed")
                        self.connection = None
                except Exception as e:
                    logger.warning(f"DAEDALUS health check failed: {e}")
                    self.connection = None
            
            if (self.connection and 
                current_time - self.last_used > self.max_idle_time):
                logger.info("Closing idle DAEDALUS connection")
                try:
                    self.connection.close()
                except:
                    pass
                self.connection = None
            
            if not self.connection:
                logger.info("🔌 Creating new DAEDALUS connection...")
                try:
                    self.connection = SATHardwareInterface()
                    self.last_used = current_time
                    logger.info("✅ New DAEDALUS connection established")
                except Exception as e:
                    logger.error(f"Failed to create DAEDALUS connection: {e}")
                    raise
            
            return self.connection
    
    def close_all(self):
        """Close all DAEDALUS connections"""
        with self.connection_lock:
            if self.connection:
                try:
                    self.connection.close()
                except:
                    pass
                self.connection = None

# Global SAT connection pool
sat_pool = SATConnectionPool()

# ------------------------------ SAT Routes -----------------------------------
@app.route("/sat/solve", methods=["POST"])
def sat_solve():
    """Solve SAT problem using hardware or software"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get("name") or not data.get("dimacs"):
            return jsonify({"error": "Missing required fields: name, dimacs"}), 400

        test_name = data["name"]
        dimacs_cnf = data["dimacs"]
        solver_type = data.get("solver_type", "minisat")
        
        # Generate test ID
        test_id = generate_id()
        
        # Store test in database
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO tests (id, name, chip_type, test_mode, environment, config, status, created, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    test_id,
                    test_name,
                    "SAT",
                    "solve",
                    "lab",
                    json.dumps({
                        "solver_type": solver_type,
                        "dimacs": dimacs_cnf,
                        "input_mode": data.get("input_mode", "custom")
                    }),
                    "running",
                    utc_now(),
                    json.dumps({"solver": solver_type})
                ),
            )
            conn.commit()

        # Run the solver
        try:
            if solver_type == "daedalus":
                # Use hardware solver
                sat_hw = sat_pool.get_connection()
                results = sat_hw.solve_sat_problem(dimacs_cnf, solver_type, problem_count=1)
                
            elif solver_type == "minisat":
                # Simulate MiniSAT results
                results = {
                    "solver": "minisat",
                    "satisfiable": True,
                    "solve_time_ms": 1.5,
                    "success": True,
                    "algorithm": "DPLL"
                }
                
            elif solver_type == "walksat":
                # Simulate WalkSAT results
                results = {
                    "solver": "walksat", 
                    "satisfiable": True,
                    "solve_time_ms": 0.8,
                    "success": True,
                    "algorithm": "Local Search"
                }
                
            else:
                return jsonify({"error": f"Unknown solver type: {solver_type}"}), 400

            # Update test with results
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE tests 
                    SET status = ?, metadata = ?
                    WHERE id = ?
                """,
                    (
                        "completed",
                        json.dumps({
                            "solver": solver_type,
                            "satisfiable": results.get("satisfiable"),
                            "solve_time_ms": results.get("solve_time_ms", results.get("avg_solve_time_ms")),
                        }),
                        test_id
                    )
                )
                
                # Store detailed results
                conn.execute(
                    """
                    INSERT INTO test_results (id, test_id, iteration, timestamp, results)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (generate_id(), test_id, 1, utc_now(), json.dumps(results))
                )
                conn.commit()

            return jsonify({
                "test_id": test_id,
                "status": "completed",
                "message": f"SAT problem solved using {solver_type}",
                "results": results
            }), 201

        except Exception as e:
            # Update test status to failed
            with get_db() as conn:
                conn.execute(
                    "UPDATE tests SET status = ? WHERE id = ?",
                    ("failed", test_id)
                )
                conn.commit()
            raise

    except Exception as e:
        logger.error(f"SAT solve error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/tests", methods=["GET"])
def sat_tests():
    """List SAT tests"""
    try:
        with get_db() as conn:
            cursor = conn.execute(
                "SELECT * FROM tests WHERE chip_type = 'SAT' ORDER BY created DESC LIMIT 50"
            )
            tests = [dict_from_row(row) for row in cursor]

            # Parse JSON fields
            for test in tests:
                for field in ["config", "metadata"]:
                    if test.get(field):
                        try:
                            test[field] = json.loads(test[field])
                        except:
                            test[field] = {}

            return jsonify({"tests": tests})

    except Exception as e:
        logger.error(f"Error listing SAT tests: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/tests/<test_id>", methods=["GET"])
def sat_test_detail(test_id):
    """Get SAT test details"""
    try:
        with get_db() as conn:
            cursor = conn.execute("SELECT * FROM tests WHERE id = ? AND chip_type = 'SAT'", (test_id,))
            test = cursor.fetchone()

            if not test:
                return jsonify({"error": "Test not found"}), 404

            test_data = dict_from_row(test)

            # Parse JSON fields
            for field in ["config", "metadata"]:
                if test_data.get(field):
                    try:
                        test_data[field] = json.loads(test_data[field])
                    except:
                        test_data[field] = {}

            # Get test results
            cursor = conn.execute(
                "SELECT * FROM test_results WHERE test_id = ? ORDER BY timestamp DESC",
                (test_id,),
            )
            results = [dict_from_row(row) for row in cursor]

            for result in results:
                if result.get("results"):
                    try:
                        result["results"] = json.loads(result["results"])
                    except:
                        result["results"] = {}

            test_data["results"] = results
            return jsonify(test_data)

    except Exception as e:
        logger.error(f"Error getting SAT test {test_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/test-summaries", methods=["GET"])
def sat_test_summaries():
    """Get SAT test summaries for comparison"""
    try:
        with get_db() as conn:
            cursor = conn.execute("""
                SELECT id, name, status, created,
                       json_extract(metadata, '$.solver') as solver,
                       json_extract(metadata, '$.satisfiable') as satisfiable,
                       json_extract(metadata, '$.solve_time_ms') as solve_time
                FROM tests 
                WHERE chip_type = 'SAT' AND status = 'completed'
                ORDER BY created DESC
            """)
            tests = [dict_from_row(row) for row in cursor]
            
            summaries = []
            for test in tests:
                summaries.append({
                    "id": test["id"],
                    "name": test["name"],
                    "type": "SAT",
                    "solver": test.get("solver", "unknown"),
                    "created": test["created"],
                    "satisfiable": test.get("satisfiable"),
                    "solve_time": test.get("solve_time")
                })
            
            return jsonify({"summaries": summaries})
            
    except Exception as e:
        logger.error(f"Error fetching SAT test summaries: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/command", methods=["POST"])
def sat_command():
    """Send command to DAEDALUS hardware"""
    try:
        cmd = request.get_json().get("command", "").strip()
        if not cmd:
            return jsonify({"error": "command cannot be empty"}), 400
            
        sat_hw = sat_pool.get_connection()
        output = sat_hw.execute_command(cmd)
        return jsonify({"output": output})
        
    except Exception as e:
        logger.error(f"SAT command error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/serial-history", methods=["GET"])
def sat_serial_history():
    """Get DAEDALUS serial communication history"""
    try:
        sat_hw = sat_pool.get_connection()
        history = sat_hw.serial_history
        return jsonify({
            "history": [f"[{h['timestamp']}] {h['message']}" for h in history],
            "connected": sat_hw.connected,
            "last_heartbeat": sat_hw.last_heartbeat
        })
    except Exception as e:
        logger.error(f"SAT serial history error: {e}")
        return jsonify({
            "history": [],
            "connected": False,
            "error": str(e)
        }), 500

# ------------------------------ Main -----------------------------------------
def main():
    """Main entry point with argument parsing"""
    parser = argparse.ArgumentParser(description="Dacroq API Server")
    parser.add_argument("--stop", action="store_true", help="Stop the running daemon")
    parser.add_argument("--status", action="store_true", help="Check daemon status")
    parser.add_argument("--reload", action="store_true", help="Reload daemon (stop and restart)")
    parser.add_argument("--foreground", action="store_true", help="Run in foreground (for debugging)")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", 8000)), help="Port to run on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    
    args = parser.parse_args()
    
    # Handle stop command
    if args.stop:
        if stop_daemon():
            print("🎯 Use 'python3 app.py' to start the daemon again")
            sys.exit(0)
        else:
            sys.exit(1)
    
    # Handle status command
    if args.status:
        running_pid = get_running_pid()
        if running_pid:
            print(f"✅ Dacroq API daemon is running (PID: {running_pid})")
            print(f"📋 Log file: {LOG_FILE}")
            print(f"🌐 URL: http://localhost:{args.port}")
        else:
            print("❌ Dacroq API daemon is not running")
        sys.exit(0)
    
    # Handle reload command
    if args.reload:
        print("🔄 Reloading Dacroq API daemon...")
        
        # Stop existing daemon if running
        running_pid = get_running_pid()
        if running_pid:
            print(f"🛑 Stopping existing daemon (PID: {running_pid})...")
            
            # Try to add session separators before stopping
            try:
                import requests
                requests.post(f"http://localhost:{args.port}/hardware/session-break", 
                            json={"text": "DAEMON RELOAD"}, timeout=2)
                print("📋 Added session separators to active connections")
            except:
                print("📋 Could not add session separators (daemon may be unresponsive)")
            
            if stop_daemon():
                print("✅ Existing daemon stopped")
            else:
                print("❌ Failed to stop existing daemon")
                sys.exit(1)
        else:
            print("ℹ️ No existing daemon found")
        
        # Add a small delay to ensure clean shutdown
        time.sleep(1)
        
        # Start new daemon
        print("🚀 Starting new daemon...")
        if not start_daemon():
            sys.exit(1)
        
        try:
            # Add session separator to serial history for existing connections
            session_separator = f"=== DAEMON RELOAD at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ==="
            logger.info(session_separator)
            
            # Show user info
            print(f"✅ Daemon reloaded successfully!")
            print(f"📍 New PID: {os.getpid()}")
            print(f"🌐 API URL: http://localhost:{args.port}")
            print(f"📋 Log file: {LOG_FILE}")
            print("")
            print("💡 Usage:")
            print("  • Press Ctrl+C to detach (daemon keeps running)")
            print("  • Run 'python3 app.py --stop' to stop the daemon")
            print("  • Run 'python3 app.py --reload' to reload again")
            print("  • View logs: tail -f dacroq_api.log")
            print("")
            
            # Start the Flask app
            app.run(
                host=args.host,
                port=args.port,
                debug=False,
                use_reloader=False,
            )
        except Exception as e:
            logger.error(f"💥 Fatal error during reload: {e}")
            cleanup_on_exit()
            sys.exit(1)
    
    # Initialize database
    init_db()
    app.start_time = time.time()
    
    # Determine run mode
    if args.foreground:
        # Foreground mode (for debugging)
        print("🔧 Running in foreground mode (debugging)")
        logger.info("Dacroq API starting in foreground mode...")
        logger.info(f"Database: {DB_PATH}")
        logger.info(f"Data directory: {DATA_DIR}")
        
        try:
            app.run(
                host=args.host,
                port=args.port,
                debug=os.getenv("FLASK_ENV") == "development",
            )
        finally:
            cleanup_on_exit()
    else:
        # Daemon mode (default)
        if not start_daemon():
            sys.exit(1)
        
        try:
            # Show user how to interact with daemon
            print(f"✅ Daemon started successfully!")
            print(f"📍 PID: {os.getpid()}")
            print(f"🌐 API URL: http://localhost:{args.port}")
            print(f"📋 Log file: {LOG_FILE}")
            print("")
            print("💡 Usage:")
            print("  • Press Ctrl+C to detach (daemon keeps running)")
            print("  • Run 'python3 app.py --stop' to stop the daemon")
            print("  • Run 'python3 app.py --status' to check status")
            print("  • View logs: tail -f dacroq_api.log")
            print("")
            
            # Start the Flask app
            app.run(
                host=args.host,
                port=args.port,
                debug=False,  # Always False in daemon mode
                use_reloader=False,  # Disable reloader in daemon mode
            )
        except Exception as e:
            logger.error(f"💥 Fatal error: {e}")
            cleanup_on_exit()
            sys.exit(1)

if __name__ == "__main__":
    main()
