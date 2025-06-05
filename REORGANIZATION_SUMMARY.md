# Dacroq Project Reorganization Summary

## ✅ Completed

### 1. Nginx Configuration Updated
- **File**: `etc/nginx/nginx.conf`
- **Changes**: Added routing for `/api/data/*` and `/api/hardware/*`
- **Routes**:
  - `/api/data/*` → localhost:8001 (Data API on website server)
  - `/api/hardware/*` → dacroq.eecs.umich.edu:8000 (Hardware API on lab server)

### 2. Data API Configuration  
- **File**: `var/www/dacroq/data/api/app.py`
- **Changes**: Updated default port to 8001 to match nginx routing
- **Purpose**: Handles database operations, user auth, test storage

### 3. Systemd Service Files
- **File**: `var/www/dacroq/systemd/dacroq-data-api.service`
- **Purpose**: Service file for Data API on website server
- **Port**: 8001

### 4. Reorganization Scripts
- **File**: `var/www/dacroq/reorganize.py`
- **Purpose**: Helper script to manage the reorganization process
- **Features**: Setup, service management, status checking

### 5. Architecture Documentation
- **File**: `var/www/dacroq/ARCHITECTURE.md`
- **Purpose**: Comprehensive guide to the new architecture
- **Includes**: Setup, API usage, deployment, troubleshooting

## 🚧 Next Steps

### 1. Create Hardware API (Lab Server)
- Extract hardware classes from `api/app.py`
- Create `api/hardware/app.py` with only hardware functionality
- Move firmware directory to `api/hardware/firmware/`
- Test hardware API independently

### 2. Update Frontend API Calls
- Change frontend to use new API routes:
  - Database calls: `/api/data/*`
  - Hardware calls: `/api/hardware/*`
- Update API client/fetch calls in React components

### 3. Deploy and Test
- Deploy nginx configuration to website server
- Start Data API service on website server  
- Start Hardware API service on lab server
- Test end-to-end functionality

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Website       │    │   Lab Server    │
│   Server        │    │   (Hardware)    │
├─────────────────┤    ├─────────────────┤
│ Next.js   :3000 │    │ Hardware   :8000│
│ Data API  :8001 │    │ API             │
│ Nginx     :443  │◄──►│ - Teensys       │
│ Webhook   :9000 │    │ - Firmware      │
└─────────────────┘    │ - GPIO Reset    │
                       └─────────────────┘
```

## 🔧 Commands to Execute

### On Website Server:
```bash
# 1. Test nginx configuration
sudo nginx -t

# 2. Reload nginx with new routing
sudo systemctl reload nginx

# 3. Start Data API
sudo systemctl start dacroq-data-api
sudo systemctl enable dacroq-data-api

# 4. Check status
systemctl status dacroq-data-api
```

### On Lab Server:
```bash
# 1. Create hardware API structure
python3 reorganize.py --setup-hardware

# 2. Create hardware API service  
python3 reorganize.py --create-services

# 3. Start Hardware API
sudo systemctl start dacroq-hardware-api
sudo systemctl enable dacroq-hardware-api
```

## 📋 Testing Checklist

- [ ] Nginx routes working (`/api/data/health`, `/api/hardware/health`)
- [ ] Data API responding on website server (`:8001`)
- [ ] Hardware API responding on lab server (`:8000`)
- [ ] Database operations working through Data API
- [ ] Teensy communication working through Hardware API
- [ ] Frontend can access both APIs through nginx routing
- [ ] CORS headers working correctly
- [ ] Authentication working through Data API

## 🔍 Verification Commands

```bash
# Test Data API directly
curl http://localhost:8001/health

# Test Data API through nginx
curl https://dacroq.net/api/data/health

# Test Hardware API directly (on lab server)
curl http://localhost:8000/health

# Test Hardware API through nginx
curl https://dacroq.net/api/hardware/health

# Check service status
python3 reorganize.py --status
```

## 📝 Benefits of New Architecture

1. **Separation of Concerns**: Hardware and data operations are isolated
2. **Scalability**: Each API can be scaled independently  
3. **Deployment**: Website updates don't affect hardware operations
4. **Development**: Easier to work on specific components
5. **Security**: Hardware API runs only on lab server with physical access
6. **Reliability**: Database operations continue even if hardware is offline

## ⚠️ Important Notes

- Only ports 80/443 are available on website server, hence nginx routing
- Hardware API needs physical access to Teensys (lab server only)
- Database stays on website server for reliability and backups
- CORS configuration needs to allow cross-server communication
- SSL certificates managed by nginx on website server 