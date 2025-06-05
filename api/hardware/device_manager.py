"""
Hardware Device Manager

Manages multiple hardware device connections, GPIO control, and firmware operations.
"""

import logging
import subprocess
import threading
import time
from pathlib import Path

import serial.tools.list_ports

# GPIO control for hardware resets
try:
    import lgpio
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

logger = logging.getLogger(__name__)


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
            import serial
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