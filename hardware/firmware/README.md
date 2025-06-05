# Dacroq Firmware

This directory contains Teensy 4.1 firmware for interfacing with analog computing chips.

## Chip Architectures

### 1. DAEDALUS (3SAT_TEENSY)
- **Purpose**: 3-SAT problem solving using analog oscillator networks
- **Chip**: Custom 28nm CMOS analog SAT solver
- **Interface**: SPI + custom scan chains
- **Key Features**:
  - Real-time SAT solving with ns-scale convergence
  - Configurable bias currents and voltages
  - Batch processing support

### 2. MEDUSA (KSAT_TEENSY) 
- **Purpose**: k-SAT problem solving for larger instances
- **Chip**: Expanded SAT solver architecture
- **Interface**: SPI + memory-mapped registers
- **Key Features**:
  - Support for up to 1016 clauses
  - Dual-tile architecture
  - Current-controlled oscillators

### 3. AMORGOS (LDPC_TEENSY)
- **Purpose**: LDPC (Low-Density Parity-Check) decoding
- **Chip**: Analog belief propagation decoder
- **Interface**: SPI + parallel data loading
- **Key Features**:
  - (96,48) LDPC code support
  - Hardware belief propagation
  - Sub-µs convergence times

## Hardware Requirements

- **Microcontroller**: Teensy 4.1 (600MHz ARM Cortex-M7)
- **Storage**: microSD card for test vectors and results
- **Interface**: SPI (up to 30MHz), I2C for DAC control
- **Power**: 5V supply, multiple regulated voltage rails

## Building and Flashing

### Prerequisites
```bash
# Install PlatformIO
pip install platformio

# Or use Arduino IDE with Teensyduino add-on
```

### Build Commands
```bash
# For LDPC decoder
cd LDPC_TEENSY
pio run

# Flash to Teensy
pio run --target upload

# Monitor serial output
pio device monitor --baud 2000000
```

### Arduino IDE Alternative
1. Install Arduino IDE
2. Install Teensyduino add-on
3. Set Board: "Teensy 4.1"
4. Set USB Type: "Serial"
5. Set CPU Speed: "600 MHz"
6. Open `src/main.cpp`
7. Click Upload

## API Protocol

All firmware implements a standardized protocol for communication with the hardware API:

### Command Structure
```
COMMAND\n
```

### Standard Commands
- `I` - Identify device
- `STATUS` - Get device status
- `HEALTH_CHECK` - Run comprehensive health check
- `RUN_TEST` - Start test vector processing
- `LED:state` - Control status LED

### Response Format
```
RESPONSE_DATA\n
```

### Binary Data Protocol
For large data transfers (test vectors, results):
```
[START_MARKER: 4 bytes] [LENGTH: 4 bytes] [DATA: LENGTH bytes] [END_MARKER: 4 bytes]
```

## Configuration

### Pin Assignments
Each firmware has chip-specific pin definitions in:
- `include/pin_definitions.h` (or similar)

### Clock Configuration
- External clock reference (usually 100MHz)
- Internal PLL for Teensy system clock
- Configurable chip clocks via registers

### Memory Layout
- **Program Flash**: ~2MB
- **RAM**: 1MB (512KB fast, 512KB slower)
- **EXTMEM**: External PSRAM (8MB on Teensy 4.1)

## Chip-Specific Details

### DAEDALUS (3SAT)
```cpp
// Key registers
#define CONTROL_REGS    0x0000
#define STATUS_REGS     0x1000
#define DATA_REGS       0x2000

// Scan chain control
#define CHAIN_LENGTH    96
#define CLOCK_PIN       9
#define DATA_IN_1       10
// ... more pins
```

### AMORGOS (LDPC)
```cpp
// Vector size
#define VECTOR_SIZE     96
#define INFO_BITS       48

// Protocol markers
#define START_MARKER    0xDEADBEEF
#define END_MARKER      0xFFFFFFFF
```


# Dacroq Multi-Teensy Firmware Management

This document explains how to use the consolidated `platformio.ini` configuration to manage all three Teensy 4.1 devices from a single location.

## Device Overview

| Device | Environment | Description | Serial Port Pattern |
|--------|-------------|-------------|-------------------|
| **LDPC Teensy** | `ldpc_teensy` | AMORGOS LDPC Decoder | `/dev/cu.usbmodem158960*` |
| **KSAT Teensy** | `ksat_teensy` | MEDUSA K-SAT Solver | `/dev/cu.usbmodem138999*` |
| **3SAT Teensy** | `sat3_teensy` | DAEDALUS 3-SAT Solver | `/dev/cu.usbmodem139000*` |

## Quick Commands

### Building Firmware
```bash
# Build specific device
pio run -e ldpc_teensy     # Build LDPC firmware only
pio run -e ksat_teensy     # Build KSAT firmware only  
pio run -e sat3_teensy     # Build 3SAT firmware only

# Build all devices
pio run                    # Build all three devices
```

### Uploading Firmware
```bash
# Upload to specific device (make sure only target device is connected)
pio run -e ldpc_teensy -t upload
pio run -e ksat_teensy -t upload
pio run -e sat3_teensy -t upload

# Clean build before upload
pio run -e ldpc_teensy -t clean upload
```

### Debug Builds
```bash
# Debug versions with reduced optimization and debug symbols
pio run -e ldpc_teensy_debug -t upload
pio run -e ksat_teensy_debug -t upload  
pio run -e sat3_teensy_debug -t upload
```

## Important Notes

### Serial Communication
- **Serial monitoring is DISABLED** in this configuration
- All serial communication is handled by `api/app.py` through the `HardwareDeviceManager`
- This prevents conflicts when multiple Teensy devices are connected simultaneously
- Use the web interface or API endpoints to monitor device communication

### Device Identification
The `app.py` automatically identifies devices by:
1. Serial port patterns (preferred method)
2. Sending `STATUS` commands and analyzing responses
3. Hardware vendor ID detection as fallback

### Upload Protocols
- **LDPC & 3SAT**: Use `teensy-cli` for automated uploads
- **KSAT**: Uses `teensy-gui` (may require manual intervention)

## Troubleshooting

### Multiple Devices Connected
If you have multiple Teensy devices connected and uploads are going to the wrong device:

1. **Disconnect all but target device**
2. **Upload firmware**
3. **Reconnect other devices**

Or specify the upload port manually:
```bash
pio run -e ldpc_teensy -t upload --upload-port /dev/cu.usbmodem158960201
```

### Build Errors
```bash
# Clean everything and rebuild
pio run -t clean
pio run

# Or clean specific environment
pio run -e ldpc_teensy -t clean
```

### Library Issues
```bash
# Force library update
pio pkg update

# Or install specific environment dependencies
pio pkg install -e ldpc_teensy
```

## Migration from Individual platformio.ini Files

The old individual `platformio.ini` files are still present in:
- `firmware/LDPC_TEENSY/platformio.ini`
- `firmware/KSAT_TEENSY/platformio.ini`  
- `firmware/3SAT_TEENSY/platformio.ini`

You can safely delete these after confirming the consolidated setup works correctly.

## Hardware Manager Integration

This setup works seamlessly with the `HardwareDeviceManager` class in `app.py`:

- Automatic device discovery and port assignment
- Concurrent serial communication without conflicts
- Centralized device status monitoring
- Automatic reconnection handling

For serial monitoring and debugging, use the web interface:
- `/ldpc/serial-history` - LDPC device communication
- `/sat/serial-history` - SAT device communication  
- `/hardware/status` - Overall hardware status 


## Development Workflow

### 1. Hardware Setup
1. Connect Teensy to development PC via USB
2. Connect analog chip via custom PCB
3. Verify power supplies and clock signals

### 2. Code Development
1. Modify source code in `src/main.cpp`
2. Update libraries in `lib/` as needed
3. Test compilation: `pio run`

### 3. Testing
```bash
# Flash firmware
pio run --target upload

# Test basic communication
echo "I" | nc localhost 2000000

# Run hardware API tests
cd ../api
python -c "from app import TeensyInterface; t = TeensyInterface(); print(t.check_connection())"
```

### 4. Debugging
- Use Serial monitor: `pio device monitor`
- Hardware debugger: SWD interface on Teensy
- Logic analyzer for SPI/I2C signals

## Performance Benchmarks

### AMORGOS LDPC Performance
- **Convergence Time**: 89ns mean (from paper)
- **Energy per Bit**: 5.47 pJ
- **Success Rate**: >99% at 7dB SNR
- **Throughput**: ~10 Mvectors/sec

### DAEDALUS SAT Performance  
- **Problem Size**: Up to 20 variables, 91 clauses
- **Solve Time**: <1µs typical
- **Success Rate**: >95% for satisfiable instances
- **Power**: ~10mW total system

## Troubleshooting

### Common Issues

1. **Serial Communication Timeout**
   ```bash
   # Check USB connection
   ls /dev/tty.usbmodem*
   
   # Verify baud rate (should be 2000000)
   ```

2. **SPI Communication Errors**
   - Verify chip power supplies
   - Check SPI clock frequency (≤30MHz)
   - Confirm pin connections

3. **Clock Instability**
   - Verify external clock source
   - Check PLL lock status
   - Monitor with oscilloscope

4. **Memory Allocation Errors**
   - Reduce buffer sizes if needed
   - Use EXTMEM for large arrays
   - Check stack usage

### Debug Modes

Enable debug output by defining:
```cpp
#define DEBUG_SERIAL  1
#define DEBUG_TIMING  1
#define DEBUG_VECTORS 1
```

## Contributing

1. Follow existing code style
2. Add comments for hardware-specific operations
3. Update this README for new features
4. Test on actual hardware before submitting

## License

Research use only. See main project license. 