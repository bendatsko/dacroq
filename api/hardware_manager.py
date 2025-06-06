# hardware_api/hardware_manager.py
import json
import os
import time
import logging
from pathlib import Path
from datetime import datetime
import serial.tools.list_ports

logger = logging.getLogger(__name__)

class HardwareConnectionManager:
    """Manages hardware connections and persists state"""
    
    def __init__(self, config_file="hardware_config.json"):
        self.config_file = Path(config_file)
        self.config = self.load_config()
        self.known_devices = {}
        
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
            "known_ports": {
                "teensy_ldpc": [
                    "/dev/cu.usbmodem158960201",
                    "/dev/tty.usbmodem158960201",
                    "/dev/ttyACM0",
                    "/dev/ttyUSB0"
                ]
            },
            "device_signatures": {
                "teensy_ldpc": {
                    "vid": 0x16C0,
                    "pid": None,  # Teensy PIDs vary
                    "description_contains": ["teensy", "usb serial"],
                    "startup_messages": ["AMORGOS LDPC", "DACROQ_BOARD:LDPC"]
                }
            },
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
    
    def scan_ports(self):
        """Scan for available serial ports and identify devices"""
        available_devices = []
        
        for port in serial.tools.list_ports.comports():
            device_info = {
                "port": port.device,
                "description": port.description,
                "vid": port.vid,
                "pid": port.pid,
                "serial_number": port.serial_number,
                "manufacturer": port.manufacturer,
                "product": port.product,
                "interface": port.interface,
                "identified_as": None
            }
            
            # Try to identify the device
            for device_name, signature in self.config["device_signatures"].items():
                if self._matches_signature(port, signature):
                    device_info["identified_as"] = device_name
                    break
            
            available_devices.append(device_info)
        
        return available_devices
    
    def _matches_signature(self, port, signature):
        """Check if a port matches a device signature"""
        # Check VID/PID
        if signature.get("vid") and port.vid != signature["vid"]:
            return False
        if signature.get("pid") and port.pid != signature["pid"]:
            return False
        
        # Check description
        if signature.get("description_contains"):
            port_desc_lower = (port.description or "").lower()
            if not any(term in port_desc_lower for term in signature["description_contains"]):
                return False
        
        return True
    
    def find_device(self, device_name):
        """Find a specific device by name"""
        # First check known ports
        known_ports = self.config["known_ports"].get(device_name, [])
        for port in known_ports:
            if self._test_port(port, device_name):
                return port
        
        # Then scan all ports
        devices = self.scan_ports()
        for device in devices:
            if device["identified_as"] == device_name:
                if self._test_port(device["port"], device_name):
                    # Add to known ports for faster lookup next time
                    if device["port"] not in known_ports:
                        self.config["known_ports"][device_name].append(device["port"])
                        self.save_config()
                    return device["port"]
        
        return None
    
    def _test_port(self, port, device_name):
        """Test if a port actually has the expected device"""
        try:
            # Try to open the port
            ser = serial.Serial(port, baudrate=2000000, timeout=1)
            time.sleep(0.5)  # Let device initialize
            
            # Check for expected startup messages
            signature = self.config["device_signatures"].get(device_name, {})
            expected_messages = signature.get("startup_messages", [])
            
            # Read any available data
            start_time = time.time()
            while time.time() - start_time < 3:
                if ser.in_waiting:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    logger.debug(f"Port {port} says: {line}")
                    
                    if any(msg in line for msg in expected_messages):
                        ser.close()
                        logger.info(f"Confirmed {device_name} on {port}")
                        return True
            
            # Try sending a status command
            ser.write(b"STATUS\n")
            time.sleep(0.5)
            
            while ser.in_waiting:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if any(msg in line for msg in expected_messages + ["STATUS:READY"]):
                    ser.close()
                    logger.info(f"Confirmed {device_name} on {port} via STATUS")
                    return True
            
            ser.close()
        except Exception as e:
            logger.debug(f"Port {port} test failed: {e}")
        
        return False
    
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
    
    def get_device_status(self):
        """Get status of all known devices"""
        status = {}
        
        for device_name in self.config["device_signatures"]:
            port = self.find_device(device_name)
            if port:
                status[device_name] = {
                    "connected": True,
                    "port": port,
                    "last_seen": datetime.utcnow().isoformat()
                }
            else:
                # Check history for last known connection
                history = [e for e in self.config["connection_history"] 
                          if e["device"] == device_name]
                last_event = history[-1] if history else None
                
                status[device_name] = {
                    "connected": False,
                    "port": None,
                    "last_seen": last_event["timestamp"] if last_event else None,
                    "last_port": last_event["port"] if last_event else None
                }
        
        return status

# Global instance
hardware_manager = HardwareConnectionManager()