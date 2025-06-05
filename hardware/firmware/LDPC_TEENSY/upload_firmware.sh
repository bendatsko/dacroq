#!/bin/bash
# upload_firmware.sh - Helper script for uploading firmware to Teensy

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Teensy LDPC Firmware Upload Helper${NC}"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "platformio.ini" ]; then
    echo -e "${RED}❌ Error: platformio.ini not found!${NC}"
    echo "Please run this script from the LDPC_TEENSY directory"
    exit 1
fi

# Function to wait for Teensy bootloader
wait_for_bootloader() {
    echo -e "${YELLOW}⏳ Waiting for Teensy bootloader...${NC}"
    echo "If the upload fails, press the physical button on your Teensy"
    
    # Wait up to 15 seconds for bootloader
    for i in {1..15}; do
        if ls /dev/cu.usbmodem* 2>/dev/null | grep -q .; then
            echo -e "${GREEN}✅ Teensy detected!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${RED}⏰ Timeout waiting for Teensy${NC}"
    return 1
}

# Function to upload firmware with retry logic
upload_firmware() {
    local attempt=$1
    echo -e "${BLUE}📤 Upload attempt $attempt...${NC}"
    
    # Run platformio upload
    if pio run --target upload; then
        echo -e "${GREEN}✅ Upload successful!${NC}"
        return 0
    else
        echo -e "${RED}❌ Upload failed${NC}"
        return 1
    fi
}

# Function to test connection after upload
test_connection() {
    echo -e "${BLUE}🔍 Testing connection...${NC}"
    
    # Wait for device to initialize
    sleep 3
    
    # Look for the expected port
    PORT=$(ls /dev/cu.usbmodem* 2>/dev/null | head -1)
    
    if [ -z "$PORT" ]; then
        echo -e "${RED}❌ No Teensy port found${NC}"
        return 1
    fi
    
    echo "Found Teensy at: $PORT"
    
    # Try to communicate with the device
    echo -e "${BLUE}📡 Testing communication...${NC}"
    
    # Use Python to test the connection
    python3 -c "
import serial
import time
import sys

try:
    ser = serial.Serial('$PORT', 2000000, timeout=2)
    time.sleep(1)
    
    # Read startup messages
    messages = []
    start_time = time.time()
    while time.time() - start_time < 5:
        if ser.in_waiting:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            messages.append(line)
            print(f'📥 {line}')
            
            if 'AMORGOS LDPC Decoder Ready' in line:
                print('✅ Hardware responding correctly!')
                ser.close()
                sys.exit(0)
    
    # Try sending a status command
    ser.write(b'STATUS\\n')
    time.sleep(1)
    
    if ser.in_waiting:
        response = ser.readline().decode('utf-8', errors='ignore').strip()
        print(f'📥 {response}')
        if 'STATUS:READY' in response:
            print('✅ Hardware responding to commands!')
            ser.close()
            sys.exit(0)
    
    print('⚠️  Hardware not responding as expected')
    ser.close()
    sys.exit(1)
    
except Exception as e:
    print(f'❌ Connection test failed: {e}')
    sys.exit(1)
"
    
    return $?
}

# Main upload process
main() {
    echo -e "${BLUE}🔧 Starting firmware upload process...${NC}"
    
    # Clean build first
    echo -e "${BLUE}🧹 Cleaning previous build...${NC}"
    pio run --target clean
    
    # Build the firmware
    echo -e "${BLUE}⚙️  Building firmware...${NC}"
    if ! pio run; then
        echo -e "${RED}❌ Build failed!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Build successful!${NC}"
    
    # Attempt upload with retries
    MAX_ATTEMPTS=3
    
    for attempt in $(seq 1 $MAX_ATTEMPTS); do
        echo -e "\n${BLUE}🔄 Upload attempt $attempt of $MAX_ATTEMPTS${NC}"
        
        if upload_firmware $attempt; then
            echo -e "${GREEN}✅ Upload completed successfully!${NC}"
            
            # Test the connection
            if test_connection; then
                echo -e "\n${GREEN}🎉 Firmware upload and test successful!${NC}"
                echo -e "${GREEN}✅ Your Teensy is ready for use${NC}"
                exit 0
            else
                echo -e "${YELLOW}⚠️  Upload succeeded but hardware test failed${NC}"
                echo -e "${YELLOW}   This might be normal - try running the API test${NC}"
                exit 0
            fi
        fi
        
        if [ $attempt -lt $MAX_ATTEMPTS ]; then
            echo -e "${YELLOW}🔄 Retrying upload...${NC}"
            echo -e "${YELLOW}💡 Press the RESET button on your Teensy now if needed${NC}"
            sleep 3
        fi
    done
    
    echo -e "\n${RED}❌ All upload attempts failed!${NC}"
    echo -e "${YELLOW}🛠️  Troubleshooting steps:${NC}"
    echo "1. Press the physical RESET button on your Teensy"
    echo "2. Check USB cable connection"
    echo "3. Ensure no other programs are using the serial port"
    echo "4. Try running: pio device list"
    echo "5. Try manual upload: pio run --target upload"
    
    exit 1
}

# Check for required tools
check_requirements() {
    if ! command -v pio &> /dev/null; then
        echo -e "${RED}❌ PlatformIO CLI not found!${NC}"
        echo "Please install PlatformIO: https://platformio.org/install/cli"
        exit 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python3 not found!${NC}"
        echo "Please install Python3"
        exit 1
    fi
    
    # Check if pyserial is available
    if ! python3 -c "import serial" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  pyserial not found - connection test will be skipped${NC}"
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Teensy LDPC Firmware Upload Helper"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --test-only    Only test connection, don't upload"
        echo "  --clean        Clean build and upload"
        echo ""
        echo "This script will:"
        echo "1. Build the LDPC firmware"
        echo "2. Upload to Teensy with automatic retries"
        echo "3. Test hardware communication"
        exit 0
        ;;
    --test-only)
        echo -e "${BLUE}🔍 Testing connection only...${NC}"
        check_requirements
        test_connection
        exit $?
        ;;
    --clean)
        echo -e "${BLUE}🧹 Clean build requested${NC}"
        check_requirements
        pio run --target clean
        main
        ;;
    "")
        check_requirements
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac 