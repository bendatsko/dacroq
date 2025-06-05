#!/usr/bin/env python3
"""
Manual Dacroq Device Setup Tool
User-guided setup to avoid race conditions by connecting devices one at a time.
"""

import subprocess
import time
import serial
import serial.tools.list_ports
import json
import sys
import os
from pathlib import Path

class ManualDeviceSetup:
    def __init__(self):
        self.discovered_devices = {}
        self.firmware_paths = {
            "ldpc": Path("LDPC_TEENSY"),
            "sat": Path("3SAT_TEENSY")
        }
    
    def wait_for_user_input(self, prompt):
        """Wait for user to press Enter"""
        input(f"\n🔵 {prompt}\nPress ENTER when ready...")
    
    def find_single_teensy(self):
        """Find exactly one Teensy device"""
        devices = []
        for port in serial.tools.list_ports.comports():
            if port.vid == 0x16C0:  # PJRC vendor ID
                devices.append(port.device)
        
        if len(devices) == 0:
            print("❌ No Teensy devices found")
            return None
        elif len(devices) == 1:
            print(f"✅ Found single Teensy at: {devices[0]}")
            return devices[0]
        else:
            print(f"⚠️ Multiple devices found: {devices}")
            print("This tool works best with one device at a time")
            return devices[0]  # Use the first one
    
    def upload_firmware_to_device(self, firmware_type):
        """Upload firmware to currently connected device"""
        firmware_dir = self.firmware_paths[firmware_type]
        
        print(f"\n🔧 Uploading {firmware_type.upper()} firmware...")
        
        try:
            result = subprocess.run(
                ["platformio", "run", "--target", "upload", "--environment", "teensy41"],
                cwd=firmware_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(f"✅ {firmware_type.upper()} firmware uploaded successfully!")
                return True
            else:
                print(f"❌ Upload failed:")
                print(result.stderr)
                return False
                
        except Exception as e:
            print(f"💥 Upload error: {e}")
            return False
    
    def identify_device(self, port):
        """Identify what firmware is running on the device"""
        print(f"\n🔍 Testing device at {port}...")
        
        try:
            time.sleep(3)  # Let device boot
            
            ser = serial.Serial(port, 2_000_000, timeout=2)
            time.sleep(2)
            
            ser.reset_input_buffer()
            ser.write(b"STATUS\n")
            ser.flush()
            
            responses = []
            start_time = time.time()
            
            while time.time() - start_time < 8:
                if ser.in_waiting:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        responses.append(line)
                        print(f"📥 {line}")
            
            ser.close()
            
            response_text = " ".join(responses)
            
            if "AMORGOS" in response_text or "LDPC" in response_text:
                print("✅ This is an LDPC device!")
                return "ldpc"
            elif "DAEDALUS" in response_text or "3-SAT" in response_text:
                print("✅ This is a SAT device!")
                return "sat"
            elif "STATUS:READY" in response_text:
                print("⚠️ Generic response - firmware unclear")
                return "unknown"
            else:
                print("❓ No recognizable response")
                return None
                
        except Exception as e:
            print(f"❌ Error testing device: {e}")
            return None
    
    def setup_device_type(self, device_type):
        """Set up one specific device type"""
        print(f"\n{'='*20} SETTING UP {device_type.upper()} DEVICE {'='*20}")
        
        # Step 1: Ask user to connect only the target device
        self.wait_for_user_input(
            f"📱 Connect ONLY your {device_type.upper()} Teensy device\n"
            f"   (disconnect all other Teensy devices to avoid conflicts)"
        )
        
        # Step 2: Find the device
        device_port = None
        for attempt in range(3):
            print(f"\n🔍 Scanning for Teensy devices (attempt {attempt + 1}/3)...")
            device_port = self.find_single_teensy()
            if device_port:
                break
            time.sleep(2)
        
        if not device_port:
            print(f"❌ Could not find {device_type.upper()} device")
            return False
        
        # Step 3: Upload correct firmware
        if not self.upload_firmware_to_device(device_type):
            print(f"❌ Failed to upload {device_type.upper()} firmware")
            return False
        
        # Step 4: Wait for reboot and verify
        print("\n⏳ Waiting for device to reboot...")
        time.sleep(5)
        
        # Find device again (port might change)
        final_port = self.find_single_teensy()
        if not final_port:
            print("❌ Device disappeared after firmware upload")
            return False
        
        # Step 5: Verify firmware
        device_type_detected = self.identify_device(final_port)
        
        if device_type_detected == device_type:
            print(f"🎉 SUCCESS: {final_port} → {device_type.upper()}")
            self.discovered_devices[final_port] = device_type
            return True
        else:
            print(f"⚠️ Device responding as: {device_type_detected}")
            # Record it anyway
            self.discovered_devices[final_port] = device_type_detected or "unknown"
            return False
    
    def run_manual_setup(self):
        """Run the complete manual setup process"""
        print("🔧 Manual Dacroq Device Setup")
        print("🎯 This tool will guide you through setting up each device individually")
        print("=" * 60)
        
        print("\n💡 IMPORTANT:")
        print("   • Connect only ONE Teensy at a time")
        print("   • This avoids USB enumeration conflicts")
        print("   • We'll set up LDPC first, then SAT")
        
        # Set up LDPC device
        ldpc_success = self.setup_device_type("ldpc")
        
        if ldpc_success:
            self.wait_for_user_input(
                "📱 Now disconnect the LDPC device and connect your SAT device"
            )
        
        # Set up SAT device  
        sat_success = self.setup_device_type("sat")
        
        # Final results
        print(f"\n{'='*20} SETUP COMPLETE {'='*20}")
        
        if self.discovered_devices:
            print("📋 Device Configuration:")
            for port, device_type in self.discovered_devices.items():
                print(f"   {port} → {device_type.upper()}")
            
            # Save mapping
            mapping_file = Path("device_mapping.json")
            with open(mapping_file, "w") as f:
                json.dump(self.discovered_devices, f, indent=2)
            print(f"\n💾 Saved to: {mapping_file}")
            
            print(f"\n🎉 Setup completed!")
            print(f"   LDPC: {'✅' if ldpc_success else '❌'}")
            print(f"   SAT:  {'✅' if sat_success else '❌'}")
            
            return True
        else:
            print("❌ No devices were successfully configured")
            return False

def main():
    print("🔧 Manual Dacroq Device Setup Tool")
    print("🍎 macOS-Friendly Sequential Setup")
    print()
    
    setup = ManualDeviceSetup()
    
    if setup.run_manual_setup():
        print("\n✨ You can now connect both devices and start the Dacroq backend!")
        print("💡 Note: The backend will handle device switching automatically.")
    else:
        print("\n❌ Setup incomplete. Please check your hardware and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main() 