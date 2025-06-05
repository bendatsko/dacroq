# Dacroq Hardware API Setup Complete

## Overview

Successfully created a comprehensive hardware API with enhanced GPIO reset control for Teensy 4.1 bootloader recovery. The system is now organized into a clean microservices architecture.

## New Directory Structure

```
/var/www/dacroq/
├── api/                    # Data API (Port 8001)
│   ├── app.py             # Database operations, auth, test storage
│   └── requirements.txt   # Data API dependencies
├── hardware/              # Hardware API (Port 8000) - NEW
│   ├── app.py            # Comprehensive hardware interface
│   ├── firmware/         # PlatformIO projects (moved here)
│   │   ├── LDPC_TEENSY/  # AMORGOS LDPC decoder
│   │   ├── 3SAT_TEENSY/  # DAEDALUS 3-SAT solver
│   │   └── KSAT_TEENSY/  # MEDUSA K-SAT solver
│   ├── requirements.txt  # Hardware API dependencies
│   ├── start.sh         # Start script
│   ├── env.example      # Environment template
│   └── README.md        # Hardware API documentation
└── web/                 # Frontend (nginx proxy)
```

## Key Features of New Hardware API

### 🔧 GPIO Reset Control (Critical for Teensy Bootloader Issues)
- **GPIO 18**: LDPC Teensy (AMORGOS) reset control
- **GPIO 19**: SAT Teensy (DAEDALUS) reset control  
- **GPIO 20**: KSAT Teensy (MEDUSA) reset control
- **Extended reset pulse**: 1.5 seconds for bootloader recovery
- **Simultaneous reset**: All devices can be reset at once

### 🔍 Enhanced Device Discovery
- Intelligent Teensy identification via serial responses
- Fallback identification by port patterns
- Auto-registration of discovered devices
- Connection history tracking

### 🚀 Comprehensive API Endpoints
- `POST /hardware/reset/<device_type>` - Reset specific device
- `POST /hardware/reset/all` - Reset all devices simultaneously
- `POST /hardware/discover` - Discover all connected devices
- `GET /hardware/gpio/status` - GPIO pin status
- `GET /debug/connections` - Debug connection issues
- `POST /firmware/build/<device_type>` - Build firmware
- `POST /firmware/upload/<device_type>` - Upload firmware
- `POST /firmware/flash/<device_type>` - Build and upload

### 🔧 Hardware Manager Features
- Connection pooling for persistent connections
- Automatic reconnection with retry logic
- Serial communication history
- Configuration persistence
- Health monitoring

## Usage

### Start Hardware API
```bash
cd /var/www/dacroq/hardware
./start.sh              # Production mode
./start.sh --dev        # Development mode
```

### Start Data API
```bash
cd /var/www/dacroq/api  
./start.sh              # Runs on port 8001
```

### GPIO Reset Example
```bash
# Reset specific device (critical for bootloader issues)
curl -X POST http://localhost:8000/hardware/reset/ldpc

# Reset all devices simultaneously
curl -X POST http://localhost:8000/hardware/reset/all

# Check GPIO status
curl http://localhost:8000/hardware/gpio/status
```

### Debug Connection Issues
```bash
# Get comprehensive debug information
curl http://localhost:8000/debug/connections
```

## Improvements Made

### From Original Code
1. **Consolidated Hardware Management**: Combined logic from `hardware_manager.py`, `test_gpio.py`, and `debug_results.py`
2. **Enhanced GPIO Control**: Extended reset pulses and simultaneous reset capability
3. **Better Error Handling**: Comprehensive error reporting and recovery
4. **Improved Device Discovery**: Multiple identification methods with fallbacks
5. **Connection Persistence**: Smart connection pooling and retry logic

### GPIO Reset for Bootloader Issues
The Teensy 4.1 bootloader can become unresponsive. The GPIO reset functionality addresses this by:
- Pulling reset lines LOW for 1.5 seconds (extended pulse)
- Ensuring clean power cycling
- Supporting mass reset for multiple devices
- Automatic re-discovery after reset

### API Cleanup
- Removed duplicate/obsolete files from `/api/` folder
- Clear separation between data and hardware operations
- Updated documentation to reflect new architecture

## On Raspberry Pi Deployment

1. **Install GPIO Library**:
   ```bash
   sudo apt install python3-lgpio
   ```

2. **Set Permissions**:
   ```bash
   sudo usermod -a -G gpio $USER
   sudo usermod -a -G dialout $USER
   ```

3. **Wire GPIO Connections**:
   - Connect GPIO 18 to LDPC Teensy reset pin
   - Connect GPIO 19 to SAT Teensy reset pin  
   - Connect GPIO 20 to KSAT Teensy reset pin

## Testing

The hardware API has been tested and imports successfully. GPIO functionality will be available when deployed on Raspberry Pi hardware.

## Next Steps

1. Deploy to Raspberry Pi and test GPIO reset functionality
2. Update nginx configuration if needed for hardware API routing
3. Test firmware build/upload operations with actual hardware
4. Configure systemd services for automatic startup

The system now provides robust hardware control with proper bootloader recovery capabilities! 