# Dacroq PM2 Quick Reference

## Service Overview

| Service | Port | Description | Purpose |
|---------|------|-------------|---------|
| `data-api` | 8001 | Data API | Database operations, authentication, test storage |
| `web-prod` | 3000 | Frontend (Production) | Optimized build with `pnpm start` |
| `web-dev` | 3001 | Frontend (Development) | Hot reloading with `pnpm run dev` |
| `webhook` | - | GitHub Webhook | Automated deployments |

**Note**: `hardware-api` runs on separate Raspberry Pi lab server (port 8000)

## Quick Commands

```bash
# Development mode (default - most common for daily work)
./pm2.sh start

# Production deployment  
./pm2.sh prod

# Development mode (explicit)
./pm2.sh dev

# Check status of all services
./pm2.sh status

# View logs
./pm2.sh logs                    # All services
./pm2.sh logs data-api           # Specific service

# Individual service control
./pm2.sh start data-api          # Start specific service
./pm2.sh stop web-dev            # Stop specific service
./pm2.sh restart data-api        # Restart specific service

# Maintenance
./pm2.sh clean                   # Stop all and clean PM2
./pm2.sh reload                  # Reload configuration
```

## Service URLs

- **Frontend (Production)**: https://dacroq.eecs.umich.edu
- **Frontend (Development)**: http://localhost:3001
- **Data API**: https://dacroq.eecs.umich.edu/api/data/* (nginx routes to port 8001)
- **Hardware API**: https://dacroq.eecs.umich.edu/api/hardware/* (nginx routes to lab server port 8000)

## Environment Configuration

### Production Mode
- `web-prod`: Uses `NEXT_PUBLIC_API_BASE_URL=https://dacroq.eecs.umich.edu`
- Optimized build, no hot reloading
- Port 3000 (behind nginx proxy)

### Development Mode  
- `web-dev`: Uses `NEXT_PUBLIC_API_BASE_URL=https://dacroq.eecs.umich.edu`
- Hot reloading enabled
- Port 3001 (direct access)

## Log Locations

```
/home/bdatsko/.pm2/logs/
├── data-api-*.log           # Data API logs
├── web-prod-*.log          # Production frontend logs
├── web-dev-*.log           # Development frontend logs
└── webhook-*.log           # Webhook logs
```

**Note**: Hardware API logs are on the lab server.

## Typical Workflows

### 🏭 Production Deployment
```bash
./pm2.sh prod      # Starts: data-api, web-prod, webhook
./pm2.sh status    # Verify all services running
```

### 🔧 Development Work (Default)
```bash
./pm2.sh start     # Default: starts data-api, web-dev
./pm2.sh status    # Check status
# Frontend available at http://localhost:3001
```

### 🔄 Update Deployment
```bash
./pm2.sh stop web-prod
cd web && pnpm build
./pm2.sh start web-prod
```

### 🐛 Debugging
```bash
./pm2.sh logs data-api        # Check data API logs
./pm2.sh restart data-api     # Restart if issues
./pm2.sh status               # Overall health check
```

## Notes

- **Production** services use optimized builds (port 3000 behind nginx)
- **Development** services enable hot reloading (direct port 3001 access)
- Both modes use the same API base URL (`https://dacroq.eecs.umich.edu`)
- Hardware API runs on separate lab server, routed through nginx
- The PM2 script prevents conflicts by stopping conflicting services automatically 