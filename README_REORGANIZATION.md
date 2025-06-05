# Dacroq API Reorganization Plan

## Overview
We're splitting the monolithic `api/app.py` into focused services for better separation of concerns:

## New Architecture

### 1. Hardware API (`api/hardware/`) - Port 8001
**Purpose**: Handles all hardware interfacing
- Device discovery and management
- Firmware building/uploading/flashing  
- GPIO control for device resets
- Serial communication with Teensy boards
- LDPC and SAT hardware testing

**Files**:
- `app.py` - Main Flask app for hardware operations
- `device_manager.py` - Hardware device discovery and management
- `teensy_interface.py` - LDPC Teensy communication (needs extraction)
- `sat_interface.py` - SAT Teensy communication (needs extraction)

### 2. Data API (`data/api/`) - Port 8002  
**Purpose**: Handles all database operations
- User authentication and management
- Test data storage and retrieval
- LDPC job management
- SAT test results
- System metrics collection
- Data analysis and summaries

**Files**:
- `app.py` - Main Flask app for data operations

### 3. Web Frontend (`web/`) - Port 3000
**Purpose**: User interface
- Communicates with both Hardware API (8001) and Data API (8002)
- Manages test workflows, data visualization, etc.

## Migration Steps

### ✅ Completed:
1. Created `api/hardware/` structure
2. Created `data/api/` structure  
3. Extracted `HardwareDeviceManager` class
4. Created Hardware API with basic routes
5. Created Data API with database operations

### 🟡 To Complete:

#### 1. Extract Teensy Interface
```bash
# Extract TeensyInterface and TeensyConnectionPool classes from api/app.py
# into api/hardware/teensy_interface.py
```

#### 2. Extract SAT Interface  
```bash
# Extract SATHardwareInterface and SATConnectionPool classes from api/app.py
# into api/hardware/sat_interface.py
```

#### 3. Update Import Statements
- Fix imports in `api/hardware/app.py` 
- Ensure all hardware modules can import each other correctly

#### 4. Create Service Scripts
```bash
# api/hardware/start.sh - Start hardware API
# data/api/start.sh - Start data API
# docker-compose.yml or systemd services for production
```

#### 5. Update Frontend Proxy
- Web frontend needs to proxy requests to both APIs
- Hardware requests → `localhost:8001`
- Data requests → `localhost:8002`

#### 6. Environment Configuration
- Update `.env` files for multi-service setup
- Database connection only needed for data API
- Hardware GPIO/serial only needed for hardware API

## Running the New Architecture

### Development:
```bash
# Terminal 1: Data API
cd data/api && python app.py --debug

# Terminal 2: Hardware API  
cd api/hardware && python app.py --debug

# Terminal 3: Web Frontend
cd web && npm run dev
```

### Production:
```bash
# Use process manager (PM2) or systemd
pm2 start ecosystem.config.js
```

## Benefits

1. **Better Separation**: Hardware and database concerns are separated
2. **Scalability**: Can run on different machines
3. **Development**: Teams can work independently
4. **Maintenance**: Smaller, focused codebases
5. **Testing**: Can test hardware and database logic separately
6. **Deployment**: Can deploy updates to services independently

## API Endpoints

### Hardware API (8001):
- `/health` - Hardware system health
- `/discover` - Discover connected devices
- `/devices` - Get device information
- `/reset/<device_type>` - Reset devices via GPIO
- `/firmware/*` - Firmware operations
- `/ldpc/command` - Send LDPC commands
- `/sat/command` - Send SAT commands
- `/session-break` - Add session separators

### Data API (8002):
- `/health` - Database health
- `/auth/google` - Authentication
- `/tests` - Test management
- `/ldpc/jobs` - LDPC job management
- `/sat/tests` - SAT test data
- `/system/metrics` - System metrics

## Configuration

### Hardware API Environment:
```env
# Hardware-specific
GPIO_ENABLED=true
PLATFORMIO_PATH=/usr/local/bin/pio
FIRMWARE_DIR=../firmware

# CORS for web frontend
ALLOWED_ORIGINS=http://localhost:3000
```

### Data API Environment:  
```env
# Database
DATABASE_PATH=database/dacroq.db

# Authentication
GOOGLE_CLIENT_ID=your_client_id

# CORS for web frontend
ALLOWED_ORIGINS=http://localhost:3000
```

## Next Actions

1. **Extract remaining classes** from `api/app.py`
2. **Fix import statements** 
3. **Test the separation** - run both APIs independently
4. **Update web frontend** to use both API endpoints
5. **Create deployment scripts**
6. **Update documentation**

This reorganization will make the codebase much more maintainable and scalable! 