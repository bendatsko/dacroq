# PM2 Setup Complete for Dacroq Platform

## Overview

Successfully configured PM2 process management for all Dacroq services with intuitive names and easy management.

## 🚀 **New PM2 Services**

### Short, Intuitive Names:
- **`data-api`** - Data API (Port 8001)
- **`hardware-api`** - Hardware API (Port 8000)  
- **`web-prod`** - Frontend Production (Port 3000)
- **`web-dev`** - Frontend Development (Port 3001)
- **`webhook`** - GitHub webhook

## 📋 **Configuration Files**

### `ecosystem.config.js`
Complete PM2 configuration with:
- ✅ All 5 services properly configured
- ✅ Correct ports and environments
- ✅ Proper Python interpreters for APIs
- ✅ Environment variables for production/development
- ✅ Log file paths
- ✅ Memory limits and restart policies

### `pm2.sh` (Management Script)
Convenient wrapper script with commands:
- `./pm2.sh prod` - Start production services
- `./pm2.sh dev` - Start development services  
- `./pm2.sh status` - Show all service status
- `./pm2.sh logs [service]` - View logs
- `./pm2.sh start/stop/restart [service]` - Control individual services

## 🎯 **Key Features**

### Smart Service Management
- **Production mode**: Starts `data-api`, `hardware-api`, `web-prod`, `webhook`
- **Development mode**: Starts `data-api`, `hardware-api`, `web-dev`
- **Conflict prevention**: Automatically stops conflicting services

### Environment Handling
- **Production (`web-prod`)**: Uses `https://dacroq.eecs.umich.edu` API URL
- **Development (`web-dev`)**: Uses `http://localhost:8001` API URL
- **Different ports**: Prod on 3000, Dev on 3001 (no conflicts)

### Logging
- Organized log files in `/home/bdatsko/.pm2/logs/`
- Separate logs for each service
- Timestamped entries

## 🛠 **Usage Examples**

### Typical Production Deployment
```bash
./pm2.sh prod      # Start all production services
./pm2.sh status    # Verify everything is running
```

### Development Work
```bash
./pm2.sh dev       # Start development environment
# Frontend available at http://localhost:3001 with hot reloading
```

### Individual Service Control
```bash
./pm2.sh start hardware-api     # Start only hardware API
./pm2.sh restart data-api       # Restart data API
./pm2.sh logs web-dev           # View development frontend logs
```

### Maintenance
```bash
./pm2.sh clean     # Stop all services and clean PM2
./pm2.sh reload    # Reload configuration after changes
```

## 🔧 **Architecture Integration**

### Service Separation
- **Data API**: Database operations, authentication, test storage
- **Hardware API**: Device control, GPIO reset, firmware management
- **Frontend**: User interface with production/development modes
- **Webhook**: Automated GitHub deployments

### Port Configuration
- **Port 8000**: Hardware API (routes: `/api/hardware/*`)
- **Port 8001**: Data API (routes: `/api/data/*`)
- **Port 3000**: Production frontend (nginx proxy)
- **Port 3001**: Development frontend (direct access)

### Environment Variables
Each service has proper environment configuration:
- Python paths for APIs
- Flask environments
- Next.js API base URLs
- Node.js paths for frontend

## ✅ **Ready for Use**

The PM2 setup is complete and ready for:
1. **Production deployments** with `./pm2.sh prod`
2. **Development work** with `./pm2.sh dev`
3. **Individual service management** as needed
4. **Log monitoring** and debugging
5. **Easy maintenance** and updates

## 📚 **Reference Files**

- `ecosystem.config.js` - PM2 configuration
- `pm2.sh` - Management script
- `PM2_QUICK_REFERENCE.md` - Command reference
- `PM2_SETUP_COMPLETE.md` - This summary

The system now has clean, intuitive PM2 service names and easy management commands for all deployment scenarios! 