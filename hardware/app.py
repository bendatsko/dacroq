#!/usr/bin/env python3
"""
Dacroq Hardware API

Comprehensive hardware interface for the Dacroq platform.
Handles all physical hardware operations including:
- Teensy 4.1 LDPC decoder communication (AMORGOS)
- DAEDALUS 3-SAT solver communication  
- Hardware discovery and device management
- GPIO-based hardware reset control for bootloader issues
- Firmware building and uploading via PlatformIO
- Serial communication and monitoring
- Hardware testing and diagnostics

This API focuses purely on hardware operations and does not handle:
- Database operations (handled by Data API)
- User authentication (handled by Data API)
- Test result storage (handled by Data API)
"""

import argparse
import atexit
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
import serial
import serial.tools.list_ports
import psutil

# GPIO control for hardware resets (critical for Teensy bootloader issues)
try:
    import lgpio
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("Warning: lgpio not available - hardware reset disabled")

from flask import Flask, jsonify, request
from dotenv import load_dotenv

# Environment setup
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
FIRMWARE_DIR = BASE_DIR / "firmware"

# Daemon management
PID_FILE = Path(__file__).parent / "dacroq_hardware_api.pid"
LOG_FILE = Path(__file__).parent / "dacroq_hardware_api.log"

# CORS configuration
ALLOWED_ORIGINS = set(
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://dacroq.net,https://www.dacroq.net,https://dacroq.eecs.umich.edu",
    ).split(",")
)

def utc_now():
    return datetime.now(timezone.utc).isoformat()

# ------------------------------ Hardware Device Manager ---------------------
class HardwareDeviceManager:
    """Enhanced hardware manager with GPIO reset and improved device discovery"""
    
    def __init__(self, config_file="hardware_config.json"):
        self.config_file = Path(config_file)
        self.active_ports = {}
        self.discovered_devices = {}
        self.device_configs = {
            "ldpc": {
                "preferred_ports": ["/dev/ttyACM0", "/dev/cu.usbmodem158960201", "/dev/tty.usbmodem158960201"],
                "startup_messages": ["AMORGOS LDPC Decoder Ready", "STATUS:READY", "DACROQ_BOARD:LDPC"],
                "test_commands": ["STATUS"],
                "device_type": "LDPC",
                "identification_keywords": ["AMORGOS", "LDPC"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/LDPC_TEENSY",
                "reset_gpio_pin": 18
            },
            "sat": {
                "preferred_ports": ["/dev/ttyACM1", "/dev/cu.usbmodem138999801", "/dev/cu.usbmodem139000201"],
                "startup_messages": ["DAEDALUS 3-SAT Solver", "STATUS:READY"],
                "test_commands": ["STATUS"],
                "device_type": "SAT",
                "identification_keywords": ["DAEDALUS", "3-SAT"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/3SAT_TEENSY",
                "reset_gpio_pin": 19
            },
            "ksat": {
                "preferred_ports": ["/dev/cu.usbmodem140001201"],
                "startup_messages": ["MEDUSA K-SAT Solver", "STATUS:READY"],
                "test_commands": ["STATUS"],
                "device_type": "KSAT",
                "identification_keywords": ["MEDUSA", "K-SAT"],
                "firmware_env": "teensy41",
                "firmware_path": "firmware/KSAT_TEENSY",
                "reset_gpio_pin": 20
            }
        }
        self.lock = threading.Lock()
        self.gpio_initialized = False
        self.gpio_handle = None
        self.config = self.load_config()
        
        self._init_gpio()
    
    def load_config(self):
        """Load configuration from file"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        
        # Default configuration
        return {
            "connection_history": [],
            "preferences": {
                "auto_reconnect": True,
                "max_reconnect_attempts": 3,
                "reconnect_delay": 2,
                "heartbeat_timeout": 15
            }
        }
    
    def save_config(self):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    def _init_gpio(self):
        """Initialize GPIO pins for hardware reset control (critical for Teensy bootloader issues)"""
        if not GPIO_AVAILABLE:
            logger.warning("GPIO not available - hardware reset functionality disabled")
            return
        
        try:
            self.gpio_handle = lgpio.gpiochip_open(0)
            logger.info("✅ GPIO chip 0 opened")
            
            # Initialize all reset pins
            for device_type, config in self.device_configs.items():
                reset_pin = config.get("reset_gpio_pin")
                if reset_pin:
                    lgpio.gpio_claim_output(self.gpio_handle, reset_pin, 1)  # HIGH = reset inactive
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
        """Perform hardware reset of specified device using GPIO (critical for Teensy bootloader issues)"""
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
            
            # Pull reset line LOW (active) for 1.5 seconds (longer for bootloader issues)
            lgpio.gpio_write(self.gpio_handle, reset_pin, 0)
            time.sleep(1.5)  # Extended reset pulse for bootloader recovery
            
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
            
            # Wait for device to boot (extended for Teensy bootloader)
            time.sleep(3)
            
            # Get the discovered port for this device
            discovered_port = self.get_device_port(device_type)
            
            self.add_connection_event(device_type, discovered_port, "reset", {"gpio_pin": reset_pin})
            
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
        """Reset all connected devices simultaneously (critical for mass bootloader recovery)"""
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
            
            time.sleep(1.5)  # Extended reset pulse
            
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
                self.add_connection_event(device_type, discovered_port, "mass_reset", {"gpio_pin": reset_pin})
            
            return {
                "success": True,
                "devices_reset": [device for device, pin in reset_pins],
                "device_details": device_ports,
                "message": f"Hardware reset completed for {len(reset_pins)} devices"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to reset all devices: {e}")
            return {"success": False, "error": str(e)}
    
    def discover_all_devices(self):
        """Enhanced auto-discovery with better Teensy identification"""
        logger.info("🔍 Starting enhanced device auto-discovery...")
        discovered = {}
        
        # Find all potential Teensy devices
        for port in serial.tools.list_ports.comports():
            # Check if it's a Teensy (PJRC vendor ID 0x16C0) or similar USB serial device
            if (port.vid == 0x16C0 or 
                "teensy" in port.description.lower() or
                "usbmodem" in port.device.lower()):
                
                device_type = self._identify_device(port.device)
                if device_type:
                    discovered[device_type] = port.device
                    logger.info(f"✅ Discovered {device_type} device at {port.device}")
                    # Auto-register the discovered device
                    self.register_port(port.device, device_type)
                    self.add_connection_event(device_type, port.device, "discovered", {"port_info": port.description})
        
        with self.lock:
            self.discovered_devices = discovered
        
        logger.info(f"🎯 Discovery complete: {list(discovered.keys())}")
        return discovered
    
    def _identify_device(self, port_name):
        """Enhanced device identification with better error handling"""
        try:
            logger.debug(f"🔍 Identifying device at {port_name}")
            
            # Quick connection test with appropriate timeout
            test_serial = serial.Serial(port_name, 2_000_000, timeout=1)
            time.sleep(0.5)  # Adequate initialization time
            
            # Clear any pending data
            test_serial.reset_input_buffer()
            
            # Send identification command
            test_serial.write(b"STATUS\n")
            test_serial.flush()
            time.sleep(0.5)  # Wait for response
            
            # Collect response with timeout
            response_lines = []
            start_time = time.time()
            while test_serial.in_waiting and (time.time() - start_time) < 1:
                try:
                    line = test_serial.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        response_lines.append(line)
                except:
                    break
            
            test_serial.close()
            response = " ".join(response_lines)
            
            logger.debug(f"Device at {port_name} responded: {response}")
            
            # Identify based on response keywords
            for device_type, config in self.device_configs.items():
                for keyword in config["identification_keywords"]:
                    if keyword in response:
                        logger.info(f"✅ Identified {device_type} device at {port_name}")
                        return device_type
            
            # Fallback identification by port patterns (for bootloader issues)
            if "158960" in port_name:
                logger.info(f"📍 Assuming LDPC device based on port pattern: {port_name}")
                return "ldpc"
            elif "138999" in port_name or "139000" in port_name:
                logger.info(f"📍 Assuming SAT device based on port pattern: {port_name}")
                return "sat"
            elif "140001" in port_name:
                logger.info(f"📍 Assuming KSAT device based on port pattern: {port_name}")
                return "ksat"
            
            # Generic STATUS:READY response handling
            if "STATUS:READY" in response:
                logger.warning(f"⚠️ Generic Teensy response at {port_name}, needs manual identification")
                return None
            
            logger.warning(f"❓ Could not identify device at {port_name}: {response}")
            return None
            
        except Exception as e:
            logger.debug(f"Failed to identify device at {port_name}: {e}")
            return None
    
    def add_connection_event(self, device_name, port, status, details=None):
        """Log a connection event"""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "device": device_name,
            "port": port,
            "status": status,
            "details": details
        }
        
        self.config["connection_history"].append(event)
        
        # Keep only last 100 events
        if len(self.config["connection_history"]) > 100:
            self.config["connection_history"] = self.config["connection_history"][-100:]
        
        self.save_config()
    
    # ... [Additional methods from original hardware manager for port management, firmware operations, etc.]
    
    def cleanup_gpio(self):
        """Clean up GPIO resources"""
        if self.gpio_initialized and self.gpio_handle is not None:
            try:
                # Ensure all reset lines are HIGH (inactive) before cleanup
                for device_type, config in self.device_configs.items():
                    reset_pin = config.get("reset_gpio_pin")
                    if reset_pin:
                        lgpio.gpio_write(self.gpio_handle, reset_pin, 1)
                        lgpio.gpio_free(self.gpio_handle, reset_pin)
                
                # Close GPIO chip handle
                lgpio.gpiochip_close(self.gpio_handle)
                self.gpio_handle = None
                self.gpio_initialized = False
                logger.info("🧹 GPIO resources cleaned up")
            except Exception as e:
                logger.warning(f"⚠️ GPIO cleanup warning: {e}")

# Global hardware device manager
hardware_manager = HardwareDeviceManager()

# ------------------------------ CORS & Middleware --------------------------- 
@app.after_request
def after_request(response):
    """Add CORS headers"""
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return "", 200

# ------------------------------ API Routes -----------------------------------
@app.route("/")
def index():
    return jsonify({
        "name": "Dacroq Hardware API",
        "version": "3.0",
        "status": "operational",
        "description": "Enhanced hardware interface with GPIO reset control",
        "endpoints": {
            "/health": "System health check",
            "/hardware/discover": "Discover and identify all connected hardware devices",
            "/hardware/reset/<device_type>": "Perform hardware reset of specified device via GPIO",
            "/hardware/reset/all": "Perform hardware reset of all devices simultaneously",
            "/hardware/gpio/status": "Get GPIO reset control status",
            "/firmware/build/<device_type>": "Build firmware for specified device type",
            "/firmware/upload/<device_type>": "Upload firmware to specified device",
            "/firmware/flash/<device_type>": "Build and upload firmware in one operation",
            "/ldpc/command": "Send command to LDPC hardware",
            "/sat/command": "Send command to SAT hardware",
            "/debug/connections": "Debug connection and GPIO status"
        }
    })

@app.route("/health")
def health():
    try:
        hw_status = hardware_manager.get_status()
        gpio_status = hardware_manager.get_gpio_status()
        
        return jsonify({
            "status": "healthy",
            "timestamp": utc_now(),
            "uptime": time.time() - app.start_time,
            "hardware": hw_status,
            "gpio": gpio_status
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

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

@app.route("/debug/connections", methods=["GET"])
def debug_connections():
    """Debug endpoint for connection and GPIO troubleshooting"""
    try:
        # Comprehensive debug information
        debug_info = {
            "timestamp": utc_now(),
            "gpio_available": GPIO_AVAILABLE,
            "gpio_initialized": hardware_manager.gpio_initialized,
            "discovered_devices": hardware_manager.discovered_devices,
            "active_ports": hardware_manager.active_ports,
            "connection_history": hardware_manager.config.get("connection_history", [])[-10:],  # Last 10 events
            "serial_ports": []
        }
        
        # Get all available serial ports
        for port in serial.tools.list_ports.comports():
            debug_info["serial_ports"].append({
                "device": port.device,
                "description": port.description,
                "vid": port.vid,
                "pid": port.pid,
                "serial_number": port.serial_number,
                "manufacturer": port.manufacturer
            })
        
        # GPIO pin status if available
        if hardware_manager.gpio_initialized:
            pin_status = {}
            for device_type, config in hardware_manager.device_configs.items():
                reset_pin = config.get("reset_gpio_pin")
                if reset_pin:
                    try:
                        current_state = lgpio.gpio_read(hardware_manager.gpio_handle, reset_pin)
                        pin_status[device_type] = {
                            "gpio_pin": reset_pin,
                            "current_state": "HIGH (inactive)" if current_state else "LOW (active)",
                            "raw_value": current_state
                        }
                    except:
                        pin_status[device_type] = {"gpio_pin": reset_pin, "status": "error"}
            debug_info["gpio_pins"] = pin_status
        
        return jsonify(debug_info)
        
    except Exception as e:
        logger.error(f"Debug connections failed: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------------------ Main Entry Point ----------------------------
def main():
    """Main entry point with daemon management"""
    parser = argparse.ArgumentParser(description="Dacroq Hardware API Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--dev", action="store_true", help="Development mode")
    
    args = parser.parse_args()
    
    # Setup cleanup on exit
    def cleanup_on_exit():
        logger.info("🧹 Performing cleanup on exit...")
        try:
            hardware_manager.cleanup_gpio()
            logger.info("✅ Cleanup completed")
        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")
    
    atexit.register(cleanup_on_exit)
    
    # Initialize Flask app
    app.start_time = time.time()
    
    # Initial hardware discovery and GPIO test
    logger.info("🔧 Dacroq Hardware API Starting")
    logger.info(f"📁 Base Directory: {BASE_DIR}")
    logger.info(f"🔧 Firmware Directory: {FIRMWARE_DIR}")
    
    # Perform initial hardware reset if GPIO available
    if hardware_manager.gpio_initialized:
        logger.info("🔄 Performing initial hardware reset of all boards...")
        try:
            reset_result = hardware_manager.reset_all_devices()
            if reset_result["success"]:
                logger.info(f"✅ Successfully reset {len(reset_result['devices_reset'])} boards")
            else:
                logger.warning(f"⚠️ Hardware reset failed: {reset_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.warning(f"⚠️ Initial hardware reset failed: {e}")
    
    try:
        logger.info(f"🌐 Hardware API URL: http://localhost:{args.port}")
        logger.info("💡 Use Ctrl+C to stop the server")
        
        app.run(
            host=args.host,
            port=args.port,
            debug=args.dev,
            use_reloader=args.dev
        )
    except KeyboardInterrupt:
        logger.info("🛑 Hardware API stopped by user")
    finally:
        cleanup_on_exit()

if __name__ == "__main__":
    main() 