# Dacroq Deployment Documentation

## System Overview

This document describes the complete deployment setup for the Dacroq web application on `dacroq.eecs.umich.edu`.

## Architecture

```
GitHub Repository (bendatsko/dacroq)
        ↓ (webhook)
Nginx (HTTPS/SSL) → PM2 Process Manager
        ↓                    ↓
   Port 443              Port 9000 (webhook)
        ↓                    ↓
   Port 3000            Auto Deployment
    (Next.js)           (deploy.sh)
```

## Directory Structure

```
/var/www/dacroq/                    # Repository root
├── web/                            # Next.js application
│   ├── src/                        # Source code
│   ├── package.json                # Dependencies
│   ├── next.config.js              # Next.js configuration
│   └── .next/                      # Built application (auto-generated)
├── webhook.js                      # GitHub webhook handler
├── deploy.sh                       # Deployment script
├── ecosystem.config.js             # PM2 configuration
├── DEPLOYMENT.md                   # This documentation
├── SYSTEM-INFO.md                  # System configuration details
└── README.md                       # Project documentation
```

## Services

### 1. Nginx Web Server
- **Purpose**: HTTPS termination and reverse proxy
- **Configuration**: `/etc/nginx/nginx.conf`
- **SSL Certificates**: Let's Encrypt
- **Ports**: 443 (HTTPS) → 3000 (Next.js), 9000 (webhook)

### 2. PM2 Process Manager
- **Purpose**: Manages Node.js applications with auto-restart
- **Configuration**: `ecosystem.config.js`
- **Processes**:
  - `dacroq-web`: Next.js application (port 3000)
  - `dacroq-webhook`: GitHub webhook handler (port 9000)

### 3. Next.js Application
- **Framework**: Next.js 15.3.1
- **Package Manager**: pnpm
- **Build Process**: `pnpm install` → `pnpm build` → `pnpm start`
- **Port**: 3000 (internal)

### 4. GitHub Webhook
- **Purpose**: Automatic deployment on git push
- **Endpoint**: `https://dacroq.eecs.umich.edu/webhook`
- **Security**: SHA-256 signature verification
- **Trigger**: Push events to main branch

## Deployment Workflow

1. **Developer pushes code** to GitHub repository
2. **GitHub sends webhook** to `https://dacroq.eecs.umich.edu/webhook`
3. **Webhook server verifies** signature and processes push event
4. **Deployment script executes**:
   - Pulls latest code (`git pull origin main`)
   - Installs dependencies (`pnpm install --frozen-lockfile`)
   - Builds application (`pnpm build`)
   - Restarts PM2 processes
5. **Website updates** with new code automatically

## Auto-Restart Configuration

### System Boot Sequence
1. **systemd** starts enabled services
2. **nginx** service starts (enabled)
3. **pm2-bdatsko** service starts (enabled)
4. **PM2 resurrects** saved processes from dump file
5. **Applications start** automatically

### Process Monitoring
- PM2 automatically restarts crashed processes
- nginx automatically handles load balancing
- systemd monitors and restarts PM2 service if needed

## Manual Operations

### Start/Stop Services
```bash
# PM2 operations
/home/bdatsko/.npm-global/bin/pm2 status
/home/bdatsko/.npm-global/bin/pm2 restart dacroq-web
/home/bdatsko/.npm-global/bin/pm2 restart dacroq-webhook
/home/bdatsko/.npm-global/bin/pm2 logs dacroq-web --lines 50

# nginx operations
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t  # test configuration

# Manual deployment
./deploy.sh
```

### Monitoring
```bash
# Check webhook logs
/home/bdatsko/.npm-global/bin/pm2 logs dacroq-webhook

# Check web application logs
/home/bdatsko/.npm-global/bin/pm2 logs dacroq-web

# Test endpoints
curl http://localhost:3000                    # Next.js app
curl http://localhost:9000/health            # Webhook health
curl https://dacroq.eecs.umich.edu          # Public site
```

## Security

- **HTTPS**: TLS 1.2+ encryption via Let's Encrypt certificates
- **Webhook Security**: SHA-256 signature verification
- **Process Isolation**: Each service runs in its own process
- **Firewall**: Only ports 22, 80, 443 exposed publicly

## Environment Variables

```bash
# Webhook configuration
WEBHOOK_SECRET=dacroq-deployment-secret-2024

# Application configuration
NODE_ENV=production
PORT=3000
```

## Backup & Recovery

### Important Files to Backup
- `/etc/nginx/nginx.conf` - nginx configuration
- `/var/www/dacroq/` - entire repository
- `/home/bdatsko/.pm2/dump.pm2` - PM2 process list
- Let's Encrypt certificates in `/etc/letsencrypt/`

### Recovery Process
1. Restore repository to `/var/www/dacroq/`
2. Install dependencies: `cd web && pnpm install`
3. Build application: `pnpm build`
4. Start PM2 processes: `pm2 start ecosystem.config.js`
5. Restore nginx configuration
6. Restart services

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if PM2 processes are running: `pm2 status`
   - Check Next.js logs: `pm2 logs dacroq-web`
   - Restart processes: `pm2 restart all`

2. **Webhook Not Working**
   - Check webhook logs: `pm2 logs dacroq-webhook`
   - Verify GitHub webhook configuration
   - Test webhook endpoint: `curl localhost:9000/health`

3. **Build Failures**
   - Check pnpm installation: `which pnpm`
   - Check Node.js version: `node --version`
   - Run deployment manually: `./deploy.sh`

4. **SSL Certificate Issues**
   - Check certificate status: `sudo certbot certificates`
   - Renew certificates: `sudo certbot renew`
   - Test nginx config: `sudo nginx -t`

## Performance Optimization

- **Gzip Compression**: Enabled in nginx
- **Static File Caching**: Configured for optimal performance  
- **Process Memory Limits**: 1GB max per process
- **Auto-scaling**: PM2 can be configured for cluster mode if needed

## Contact & Support

- **Repository**: https://github.com/bendatsko/dacroq
- **Server**: dacroq.eecs.umich.edu
- **Administrator**: bdatsko@umich.edu 