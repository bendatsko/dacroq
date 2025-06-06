#!/bin/bash

# DAEDALUS 3-SAT Teensy Firmware Upload Script
# Usage: ./upload_firmware.sh

echo "🚀 DAEDALUS 3-SAT Solver - Firmware Upload"
echo "=========================================="

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null; then
    echo "❌ PlatformIO CLI not found. Please install it first:"
    echo "   pip install platformio"
    exit 1
fi

# Check if platformio.ini exists
if [ ! -f "platformio.ini" ]; then
    echo "❌ platformio.ini not found. Make sure you're in the firmware directory."
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo "🔧 Building firmware..."

# Build the firmware
if pio run; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "🔌 Uploading to Teensy..."

# Upload the firmware
if pio run --target upload; then
    echo "✅ Upload successful!"
    echo ""
    echo "🎉 DAEDALUS 3-SAT firmware is now running!"
    echo ""
    echo "📋 Available commands:"
    echo "   STATUS           - Check chip status"
    echo "   HEALTH_CHECK     - Verify chip health"
    echo "   CALIBRATION:START - Run calibration"
    echo "   SAT_TEST:uf20:1  - Run single 3-SAT test"
    echo "   BATCH:uf20-91:10 - Run batch of 10 problems"
    echo "   BLINK            - Blink LED"
    echo "   LED:ON/OFF       - Control LED"
    echo "   RESET            - Reset to idle state"
    echo ""
    echo "🔗 Connect via serial monitor at 2000000 baud"
else
    echo "❌ Upload failed!"
    echo "💡 Troubleshooting:"
    echo "   1. Check Teensy is connected via USB"
    echo "   2. Press the program button on Teensy"
    echo "   3. Check USB cable and port"
    echo "   4. Verify Teensy 4.1 is detected by system"
    exit 1
fi 