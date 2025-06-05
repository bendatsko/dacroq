# Dacroq Project Architecture

## Overview

The Dacroq project is now organized into three main components:

1. **🌐 Website** - Next.js frontend on the website server
2. **🗄️ Data API** - Database and data management on the website server  
3. **🔧 Hardware API** - Teensy interfacing and firmware management on the lab server

## Architecture Diagram

```
Internet → nginx (dacroq.net:443/80) → Routes:
├── /                    → Next.js Website (:3000)
├── /api/data/*          → Data API (:8001)  
├── /api/hardware/*      → Hardware API (lab-server:8000)
└── /webhook             → GitHub Webhook (:9000)
```

## Components

### 1. Website (Next.js Frontend)
- **Location**: `web/`
- **Port**: 3000
- **Purpose**: User interface for the Dacroq platform
- **Service**: `dacroq-web`

### 2. Data API 
- **Location**: `data/api/`
- **Port**: 8001  
- **Purpose**: Database operations, user management, test storage
- **Service**: `dacroq-data-api`
- **Endpoints**:
  - `/auth/google` - Google OAuth authentication
  - `/tests` - Test management
  - `/ldpc/jobs` - LDPC job management
  - `/sat/tests` - SAT test results
  - `/system/metrics` - System metrics

### 3. Hardware API
- **Location**: `api/hardware/`
- **Port**: 8000
- **Purpose**: Teensy interfacing, firmware management, hardware control
- **Service**: `dacroq-hardware-api`
- **Endpoints**:
  - `/hardware/discover` - Device discovery
  - `/hardware/status` - Hardware status
  - `/firmware/build/<device>` - Build firmware
  - `/firmware/upload/<device>` - Upload firmware  
  - `/hardware/reset/<device>` - GPIO reset control
  - `/ldpc/command` - LDPC Teensy commands
  - `/sat/command` - DAEDALUS commands

## Directory Structure

```
var/www/dacroq/
├── web/                    # Next.js website
├── data/
│   ├── api/               # Data API (port 8001)
│   ├── database/          # SQLite database
│   ├── ldpc/             # LDPC test data
│   └── sat/              # SAT test data
├── api/
│   ├── hardware/         # Hardware API (port 8000)
│   │   ├── firmware/     # PlatformIO projects
│   │   │   ├── LDPC_TEENSY/
│   │   │   ├── 3SAT_TEENSY/
│   │   │   └── KSAT_TEENSY/
│   │   └── app.py        # Hardware API entry point
│   └── app.py            # Legacy combined API
├── systemd/              # Service files
│   ├── dacroq-web.service
│   ├── dacroq-data-api.service
│   └── dacroq-hardware-api.service
└── nginx/                # Nginx configuration
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install Python dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install Node.js dependencies (for website)
cd web && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 3. Setup Services

```bash
# Run the reorganization script
python3 reorganize.py --setup-hardware
python3 reorganize.py --setup-data
python3 reorganize.py --create-services
```

### 4. Update Nginx

```bash
# Update nginx configuration
python3 reorganize.py --update-nginx

# Or manually copy the config
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Start Services

```bash
# Start all services
python3 reorganize.py --start-all

# Or start individually
systemctl start dacroq-data-api
systemctl start dacroq-hardware-api
systemctl start dacroq-web
```

## API Usage

### Data API Endpoints

All data endpoints are prefixed with `/api/data/`:

```javascript
// Authentication
POST /api/data/auth/google

// Tests
GET  /api/data/tests
POST /api/data/tests
GET  /api/data/tests/{id}
PUT  /api/data/tests/{id}
DELETE /api/data/tests/{id}

// LDPC Jobs
GET  /api/data/ldpc/jobs
POST /api/data/ldpc/jobs
GET  /api/data/ldpc/jobs/{id}

// SAT Tests
GET  /api/data/sat/tests
GET  /api/data/sat/tests/{id}

// System
GET  /api/data/system/metrics
```

### Hardware API Endpoints

All hardware endpoints are prefixed with `/api/hardware/`:

```javascript
// Hardware Discovery
POST /api/hardware/hardware/discover
GET  /api/hardware/hardware/status

// Firmware Management
POST /api/hardware/firmware/build/{device_type}
POST /api/hardware/firmware/upload/{device_type}
POST /api/hardware/firmware/flash/{device_type}

// Hardware Control
POST /api/hardware/hardware/reset/{device_type}
POST /api/hardware/hardware/reset/all
GET  /api/hardware/hardware/gpio/status

// Device Communication
POST /api/hardware/ldpc/command
POST /api/hardware/sat/command
GET  /api/hardware/ldpc/serial-history
GET  /api/hardware/sat/serial-history
```

## Development Workflow

### 1. Frontend Development (Website Server)

```bash
cd web
npm run dev
# Website available at http://localhost:3000
```

### 2. Data API Development (Website Server)

```bash
cd data/api
python3 app.py --debug --port 8001
```

### 3. Hardware API Development (Lab Server)

```bash
cd api/hardware  
python3 app.py --debug --port 8000
```

## Service Management

### Check Status

```bash
# Check all services
python3 reorganize.py --status

# Check individual services
systemctl status dacroq-data-api
systemctl status dacroq-hardware-api
systemctl status dacroq-web
systemctl status nginx
```

### View Logs

```bash
# Data API logs
journalctl -u dacroq-data-api -f

# Hardware API logs  
journalctl -u dacroq-hardware-api -f

# Website logs
journalctl -u dacroq-web -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart individual service
systemctl restart dacroq-data-api

# Restart all services
systemctl restart dacroq-data-api dacroq-hardware-api dacroq-web
systemctl reload nginx
```

## Deployment

### Website Server Deployment

```bash
# Pull latest code
git pull origin main

# Update website
cd web && npm run build && cd ..
systemctl restart dacroq-web

# Update data API  
systemctl restart dacroq-data-api

# Reload nginx
systemctl reload nginx
```

### Lab Server Deployment

```bash
# Pull latest code
git pull origin main

# Restart hardware API
systemctl restart dacroq-hardware-api
```

## Troubleshooting

### Port Conflicts

- Website: 3000
- Data API: 8001  
- Hardware API: 8000
- Webhook: 9000

### Common Issues

1. **Hardware API not reachable**: Check firewall and port forwarding
2. **Database errors**: Check file permissions in `data/database/`
3. **Teensy connection issues**: Check hardware manager and GPIO permissions
4. **Nginx routing issues**: Check `/var/log/nginx/error.log`

### Debug Mode

```bash
# Run APIs in debug mode
cd data/api && python3 app.py --debug
cd api/hardware && python3 app.py --debug
```

## Security

- All services run as the `dacroq` user
- Database files have restricted permissions
- Hardware API requires GPIO access for reset control
- CORS is configured for allowed origins only
- Nginx handles SSL termination

## Monitoring

The system includes monitoring endpoints:

- `/api/data/health` - Data API health check
- `/api/hardware/health` - Hardware API health check  
- `/api/data/system/metrics` - System resource usage 