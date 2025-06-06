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
cd ../hardware_api
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