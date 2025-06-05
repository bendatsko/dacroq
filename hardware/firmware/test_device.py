#!/usr/bin/env python3
import serial
import time
import sys

def test_device(port):
    print(f"🔍 Testing device at {port}")
    try:
        ser = serial.Serial(port, 2000000, timeout=2)
        time.sleep(2)
        
        print("📤 Sending STATUS command...")
        ser.write(b'STATUS\n')
        ser.flush()
        time.sleep(2)
        
        responses = []
        while ser.in_waiting:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                responses.append(line)
                print(f"📥 Device says: {line}")
        
        ser.close()
        
        # Analyze response
        response_text = " ".join(responses)
        if "AMORGOS" in response_text or "LDPC" in response_text:
            print("✅ This is an LDPC device!")
            return "ldpc"
        elif "DAEDALUS" in response_text or "3-SAT" in response_text:
            print("✅ This is a SAT device!")
            return "sat"
        else:
            print(f"❓ Unknown device type: {response_text}")
            return "unknown"
            
    except Exception as e:
        print(f"❌ Error testing device: {e}")
        return "error"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        device_type = test_device(sys.argv[1])
        print(f"\n🎯 Result: {sys.argv[1]} → {device_type}")
    else:
        print("Usage: python test_device.py /dev/cu.usbmodem123456") 