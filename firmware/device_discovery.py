#!/usr/bin/env python3
"""
Dacroq Hardware Discovery Tool
Automatically discovers and maps Teensy devices by uploading firmware and querying responses.
Handles macOS USB enumeration race conditions.
"""

import subprocess
import time
import serial
import serial.tools.list_ports
import json
import sys
import os
from pathlib import Path

class TeensyDiscoverer:
    def __init__(self):
        self.discovered_devices = {}
        self.firmware_paths = {
            "ldpc": Path("LDPC_TEENSY"),
            "sat": Path("3SAT_TEENSY")
        }
        
    def usb_reset(self):
        """Reset USB subsystem to clear enumeration cache (macOS specific)"""
        print("🔄 Resetting USB subsystem to clear device cache...")
        try:
            # Kill any processes that might be holding USB devices
            subprocess.run(["sudo", "killall", "-STOP", "usbd"], capture_output=True)
            time.sleep(1)
            subprocess.run(["sudo", "killall", "-CONT", "usbd"], capture_output=True)
            time.sleep(2)
            print("✅ USB subsystem reset completed")
        except Exception as e:
            print(f"⚠️ USB reset failed (might need sudo): {e}")
            print("💡 Continuing without reset...")
    
    def wait_for_usb_stability(self, timeout=15):
        """Wait for USB enumeration to stabilize after device changes"""
        print("⏳ Waiting for USB enumeration to stabilize...")
        
        stable_count = 0
        last_devices = set()
        
        for i in range(timeout):
            current_devices = set()
            for port in serial.tools.list_ports.comports():
                if port.vid == 0x16C0:  # PJRC vendor ID
                    current_devices.add(port.device)
            
            if current_devices == last_devices:
                stable_count += 1
                if stable_count >= 3:  # 3 consecutive stable readings
                    print(f"✅ USB devices stabilized: {list(current_devices)}")
                    return list(current_devices)
            else:
                stable_count = 0
            
            last_devices = current_devices
            print(f"🔍 Scan {i+1}: Found {len(current_devices)} devices")
            time.sleep(1)
        
        print("⚠️ USB enumeration didn't fully stabilize, using current state")
        return list(last_devices)
        
    def find_teensy_devices(self):
        """Find all connected Teensy devices with stability check"""
        print("📍 Scanning for Teensy devices...")
        teensys = []
        for port in serial.tools.list_ports.comports():
            if port.vid == 0x16C0:  # PJRC Vendor ID
                teensys.append(port.device)
                print(f"📍 Found Teensy at: {port.device}")
        return teensys
    
    def upload_firmware(self, firmware_type, target_port=None):
        """Upload firmware to a Teensy device with race condition handling"""
        firmware_dir = self.firmware_paths[firmware_type]
        
        print(f"🔧 Uploading {firmware_type.upper()} firmware from {firmware_dir}")
        print("⚠️ This may temporarily disconnect other USB devices...")
        
        # Close any existing serial connections that might interfere
        try:
            subprocess.run(["lsof", "-t", "/dev/cu.usbmodem*"], capture_output=True, check=False)
        except:
            pass
        
        try:
            result = subprocess.run(
                ["platformio", "run", "--target", "upload", "--environment", "teensy41"],
                cwd=firmware_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(f"✅ {firmware_type.upper()} firmware uploaded successfully")
                print("⏳ Waiting for device reboot and re-enumeration...")
                time.sleep(5)  # Give device time to reboot
                return True
            else:
                print(f"❌ Failed to upload {firmware_type.upper()} firmware:")
                print(result.stderr)
                return False
                
        except subprocess.TimeoutExpired:
            print(f"⏰ Upload timeout for {firmware_type.upper()} firmware")
            return False
        except Exception as e:
            print(f"💥 Upload error for {firmware_type.upper()}: {e}")
            return False
    
    def identify_device(self, port, timeout=10):
        """Connect to a device and identify what type it is"""
        print(f"🔍 Identifying device at {port}...")
        
        # Check if port actually exists
        if not os.path.exists(port):
            print(f"❌ Port {port} does not exist")
            return None
        
        try:
            # Give device time to boot after firmware upload
            time.sleep(3)
            
            ser = serial.Serial(port, 2_000_000, timeout=2)
            time.sleep(2)  # Let device initialize
            
            # Clear any pending data
            ser.reset_input_buffer()
            
            # Send STATUS command
            ser.write(b"STATUS\n")
            ser.flush()
            print(f"📤 Sent STATUS command to {port}")
            
            # Collect responses
            responses = []
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                if ser.in_waiting:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        responses.append(line)
                        print(f"📥 {port}: {line}")
            
            ser.close()
            
            # Analyze responses to identify device type
            response_text = " ".join(responses)
            
            if "AMORGOS" in response_text or "LDPC" in response_text:
                print(f"✅ Identified LDPC device at {port}")
                return "ldpc"
            elif "DAEDALUS" in response_text or "3-SAT" in response_text:
                print(f"✅ Identified SAT device at {port}")
                return "sat"
            elif "STATUS:READY" in response_text:
                print(f"⚠️ Generic Teensy response at {port} - device type unclear")
                return "unknown"
            else:
                print(f"❓ No recognizable response from {port}")
                return None
                
        except Exception as e:
            print(f"❌ Failed to identify device at {port}: {e}")
            return None
    
    def discover_and_map_sequential(self):
        """Sequential discovery to avoid race conditions"""
        print("🚀 Starting Sequential Dacroq Hardware Discovery")
        print("🔧 Using race-condition-safe sequential programming")
        print("=" * 60)
        
        # Step 1: Reset USB subsystem
        self.usb_reset()
        
        # Step 2: Find initial devices
        initial_ports = self.wait_for_usb_stability()
        if not initial_ports:
            print("❌ No Teensy devices found! Please connect your hardware.")
            return False
        
        print(f"📊 Found {len(initial_ports)} Teensy device(s) initially")
        
        # Step 3: Program each firmware type sequentially with full USB reset between
        for firmware_idx, firmware_type in enumerate(["ldpc", "sat"]):
            print(f"\n{'='*20} PROGRAMMING {firmware_type.upper()} ({'{'}{firmware_idx+1}/2{'}'}) {'='*20}")
            
            # Upload firmware
            if not self.upload_firmware(firmware_type):
                print(f"⚠️ Failed to upload {firmware_type.upper()} firmware, skipping...")
                continue
            
            # Wait for USB to stabilize after programming
            print("⏳ Waiting for USB stabilization after firmware upload...")
            current_ports = self.wait_for_usb_stability(timeout=10)
            
            # Try to identify the newly programmed device
            device_found = False
            for port in current_ports:
                if port not in self.discovered_devices:
                    print(f"\n🔍 Testing new/changed device: {port}")
                    device_type = self.identify_device(port)
                    if device_type == firmware_type:
                        self.discovered_devices[port] = firmware_type
                        print(f"🎉 SUCCESS: {port} → {firmware_type.upper()}")
                        device_found = True
                        break
                    elif device_type and device_type != firmware_type:
                        # Found a different device type, record it anyway
                        self.discovered_devices[port] = device_type
                        print(f"📝 Recorded different device: {port} → {device_type.upper()}")
            
            if not device_found:
                print(f"⚠️ Could not find {firmware_type.upper()} device after programming")
            
            # Brief pause before next firmware
            if firmware_idx < 1:  # Not the last one
                print(f"\n⏸️ Pausing before next firmware upload...")
                time.sleep(3)
        
        # Step 4: Final verification
        print(f"\n{'='*20} FINAL VERIFICATION {'='*20}")
        final_ports = self.wait_for_usb_stability(timeout=5)
        
        print(f"📊 Final scan found: {final_ports}")
        print(f"🗂️ Discovered mapping: {self.discovered_devices}")
        
        # Step 5: Report results
        print("\n" + "=" * 50)
        print("📋 DISCOVERY RESULTS")
        print("=" * 50)
        
        if self.discovered_devices:
            for port, device_type in self.discovered_devices.items():
                print(f"✅ {port} → {device_type.upper()}")
                
            # Save mapping to file
            mapping_file = Path("device_mapping.json")
            with open(mapping_file, "w") as f:
                json.dump(self.discovered_devices, f, indent=2)
            print(f"\n💾 Device mapping saved to {mapping_file}")
            
            return True
        else:
            print("❌ No devices successfully identified!")
            return False

    # Keep the old method as backup
    discover_and_map = discover_and_map_sequential

def main():
    print("🔧 Dacroq Hardware Discovery Tool v2.0")
    print("🍎 macOS Race-Condition-Safe Edition")
    print("This tool will sequentially upload firmware and identify your hardware devices.\n")
    
    discoverer = TeensyDiscoverer()
    
    if discoverer.discover_and_map():
        print("\n🎉 Discovery completed successfully!")
        print("You can now start the Dacroq backend with proper device mapping.")
        print("\n💡 Note: On macOS, only one device may be active at a time due to USB enumeration issues.")
    else:
        print("\n❌ Discovery failed. Please check your hardware connections.")
        print("\n🔧 Troubleshooting:")
        print("  1. Ensure both Teensy devices are connected")
        print("  2. Try running with sudo for USB reset privileges") 
        print("  3. Disconnect and reconnect devices")
        print("  4. Check System Information > USB for device visibility")
        sys.exit(1)

if __name__ == "__main__":
    main() 