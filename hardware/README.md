# Dacroq Hardware API

Enhanced hardware interface for the Dacroq platform with comprehensive GPIO reset control and device management.

## Features

- **GPIO Reset Control**: Hardware reset via GPIO pins for Teensy 4.1 bootloader recovery
- **Device Auto-Discovery**: Intelligent identification of LDPC, SAT, and KSAT hardware
- **Firmware Management**: Build and upload firmware using PlatformIO
- **Serial Communication**: Direct hardware communication and monitoring
- **Connection Persistence**: Maintains device connections and handles recovery

## GPIO Pin Configuration

| Device | GPIO Pin | Description |
|--------|----------|-------------|
| LDPC (AMORGOS) | 18 | LDPC Teensy reset control |
| SAT (DAEDALUS) | 19 | 3-SAT Teensy reset control |
| KSAT (MEDUSA) | 20 | K-SAT Teensy reset control |

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies (Ubuntu/Debian)
sudo apt update
sudo apt install -y python3-lgpio

# For Raspberry Pi OS
sudo apt install -y python3-rpi.lgpio
```

## Usage

### Development Mode
```bash
python3 app.py --dev --port 8000
```

### Production Mode
```bash
python3 app.py --port 8000
```

### Key Endpoints

- `GET /health` - System health and GPIO status
- `POST /hardware/discover` - Discover all connected devices
- `POST /hardware/reset/<device_type>` - Reset specific device
- `POST /hardware/reset/all` - Reset all devices simultaneously
- `GET /hardware/gpio/status` - GPIO pin status
- `GET /debug/connections` - Debug connection issues

## Troubleshooting

### Teensy Bootloader Issues

If a Teensy device is not responding:

1. **Hardware Reset**: Use the `/hardware/reset/<device_type>` endpoint
2. **Mass Reset**: Use `/hardware/reset/all` for all devices
3. **Manual Reset**: Press the physical reset button on the Teensy
4. **Debug**: Use `/debug/connections` to see connection status

### GPIO Permissions

If GPIO access fails:
```bash
# Add user to gpio group
sudo usermod -a -G gpio $USER

# Or run with sudo (not recommended for production)
sudo python3 app.py
```

### Serial Port Permissions

If serial ports are not accessible:
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Set appropriate permissions
sudo chmod 666 /dev/ttyACM* /dev/ttyUSB*
```

## Configuration

The hardware manager uses `hardware_config.json` to store:
- Connection history
- Device preferences
- Auto-reconnection settings

## API Integration

This hardware API is designed to work with the Dacroq Data API:
- Hardware API: Port 8000 (this service)
- Data API: Port 8001 (database operations)
- Frontend routes through nginx proxy

## Firmware Structure

```
firmware/
├── LDPC_TEENSY/     # AMORGOS LDPC decoder
├── 3SAT_TEENSY/     # DAEDALUS 3-SAT solver  
└── KSAT_TEENSY/     # MEDUSA K-SAT solver
```

Each firmware project uses PlatformIO with the `teensy41` environment. 