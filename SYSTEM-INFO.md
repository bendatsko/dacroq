# System Configuration Details

## Server Information

- **Hostname**: dacroq.eecs.umich.edu
- **OS**: Red Hat Enterprise Linux 9 (Kernel 5.14.0-503.21.1.el9_5.x86_64)
- **User**: bdatsko
- **Home Directory**: /home/bdatsko
- **Repository Location**: /var/www/dacroq

## Software Versions

- **Node.js**: Latest LTS (managed via npm)
- **npm**: Global installation at `/home/bdatsko/.npm-global`
- **pnpm**: v10.11.1 (installed globally)
- **PM2**: v6.0.6 (installed globally)
- **Next.js**: v15.3.1
- **nginx**: v1.20.1

## Directory Paths

```bash
# Application directories
/var/www/dacroq/                        # Repository root
/var/www/dacroq/web/                    # Next.js application
/var/www/dacroq/web/.next/              # Built Next.js app

# Configuration files
/var/www/dacroq/ecosystem.config.js     # PM2 configuration
/var/www/dacroq/webhook.js              # Webhook handler
/var/www/dacroq/deploy.sh               # Deployment script

# System configuration
/etc/nginx/nginx.conf                   # nginx configuration
/etc/systemd/system/pm2-bdatsko.service # PM2 systemd service

# Runtime directories
/home/bdatsko/.pm2/                     # PM2 runtime data
/home/bdatsko/.npm-global/              # Global npm packages
```

## Network Configuration

### Ports
- **443** (HTTPS) - nginx public endpoint
- **80** (HTTP) - nginx redirect to HTTPS
- **3000** (internal) - Next.js application
- **9000** (internal) - GitHub webhook handler

### nginx Configuration
```nginx
# Main server block
server {
    listen 443 ssl http2;
    server_name dacroq.eecs.umich.edu;
    
    # SSL configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/dacroq.eecs.umich.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dacroq.eecs.umich.edu/privkey.pem;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Next.js application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # GitHub webhook endpoint
    location /webhook {
        proxy_pass http://localhost:9000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

## PM2 Configuration

### Ecosystem Configuration (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [
    {
      name: 'dacroq-web',
      cwd: '/var/www/dacroq/web',
      script: '/home/bdatsko/.npm-global/bin/pnpm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PATH: '/home/bdatsko/.npm-global/bin:/usr/local/bin:/usr/bin:/bin'
      }
    },
    {
      name: 'dacroq-webhook',
      cwd: '/var/www/dacroq',
      script: 'webhook.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'dacroq-deployment-secret-2024'
      }
    }
  ]
};
```

### Systemd Service (`/etc/systemd/system/pm2-bdatsko.service`)
```ini
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=bdatsko
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/home/bdatsko/.npm-global/bin:/usr/local/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/bdatsko/.pm2
PIDFile=/home/bdatsko/.pm2/pm2.pid
Restart=on-failure

ExecStart=/home/bdatsko/.npm-global/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=/home/bdatsko/.npm-global/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=/home/bdatsko/.npm-global/lib/node_modules/pm2/bin/pm2 kill

[Install]
WantedBy=multi-user.target
```

## GitHub Webhook Configuration

### Repository Settings
- **Repository**: bendatsko/dacroq
- **Webhook URL**: https://dacroq.eecs.umich.edu/webhook
- **Content Type**: application/json
- **Secret**: dacroq-deployment-secret-2024
- **Events**: Push events only
- **Active**: Yes

### Webhook Handler Features
- SHA-256 signature verification
- Push event filtering (main branch only)
- Automatic deployment execution
- Health check endpoint at `/health`
- Comprehensive logging

## Deployment Script (`deploy.sh`)

```bash
#!/bin/bash
set -e

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Starting deployment..."
cd /var/www/dacroq
git pull origin main

cd /var/www/dacroq/web
/home/bdatsko/.npm-global/bin/pnpm install --frozen-lockfile
/home/bdatsko/.npm-global/bin/pnpm build

/home/bdatsko/.npm-global/bin/pm2 restart dacroq-web --update-env
log "✅ Deployment completed successfully!"
```

## SSL Certificates

### Let's Encrypt Configuration
- **Certificate Path**: `/etc/letsencrypt/live/dacroq.eecs.umich.edu/`
- **Auto-renewal**: Configured via cron
- **Renewal Command**: `sudo certbot renew`

## File Permissions

```bash
# Repository permissions
/var/www/dacroq/          - bdatsko:bdatsko 755
/var/www/dacroq/deploy.sh - bdatsko:bdatsko 755 (executable)
/var/www/dacroq/web/      - bdatsko:bdatsko 755

# System configuration
/etc/nginx/nginx.conf     - root:root 644
/etc/systemd/system/pm2-bdatsko.service - root:root 644
```

## Environment Variables

### Production Environment
```bash
NODE_ENV=production
PORT=3000
WEBHOOK_SECRET=dacroq-deployment-secret-2024
PATH=/home/bdatsko/.npm-global/bin:/usr/local/bin:/usr/bin:/bin
PM2_HOME=/home/bdatsko/.pm2
```

## Log Locations

```bash
# PM2 logs
/home/bdatsko/.pm2/logs/dacroq-web-out.log
/home/bdatsko/.pm2/logs/dacroq-web-error.log
/home/bdatsko/.pm2/logs/dacroq-webhook-out.log
/home/bdatsko/.pm2/logs/dacroq-webhook-error.log

# nginx logs
/var/log/nginx/access.log
/var/log/nginx/error.log

# System logs
journalctl -u nginx
journalctl -u pm2-bdatsko
```

## Service Dependencies

```
Internet → nginx → PM2 → Node.js Applications
  ↓         ↓       ↓         ↓
 HTTPS    Proxy   Process   dacroq-web (3000)
          SSL     Manager   dacroq-webhook (9000)
```

## Resource Limits

- **Memory**: 1GB max per PM2 process
- **CPU**: No explicit limits (uses available cores)
- **File Descriptors**: Unlimited for PM2 service
- **Processes**: Unlimited for PM2 service

## Security Configuration

### Network Security
- Only ports 22, 80, 443 exposed externally
- Internal communication on localhost only
- HTTPS enforced for all web traffic

### Application Security
- Process isolation via PM2
- Webhook signature verification
- No sensitive data in environment variables (stored separately)
- Regular security updates via system package manager

## Monitoring Commands

```bash
# Quick health check
curl -s https://dacroq.eecs.umich.edu > /dev/null && echo "✅ Site up" || echo "❌ Site down"

# Check all services
sudo systemctl status nginx pm2-bdatsko

# Check PM2 processes
/home/bdatsko/.npm-global/bin/pm2 status

# View real-time logs
/home/bdatsko/.npm-global/bin/pm2 logs --lines 100

# Test webhook
curl -s http://localhost:9000/health
```

## Recovery Procedures

### Complete System Recovery
1. Clone repository: `git clone https://github.com/bendatsko/dacroq.git /var/www/dacroq`
2. Install Node.js and global packages
3. Configure nginx with SSL certificates
4. Set up PM2 with systemd integration
5. Configure GitHub webhook
6. Start all services

### Quick Application Recovery
1. `cd /var/www/dacroq`
2. `git pull origin main`
3. `cd web && pnpm install && pnpm build`
4. `pm2 restart all`

## Backup Strategy

### Critical Files
- Repository code (backed up via Git)
- nginx configuration
- PM2 process dump
- SSL certificates
- System service configurations 