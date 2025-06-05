#!/bin/bash

# Deployment script for dacroq website
# This script pulls the latest code, installs dependencies, builds the app, and restarts services

set -e  # Exit on any error

# Function to log with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Starting deployment..."

# Change to the correct directory
cd /var/www/dacroq

# Pull the latest code from GitHub
log "📥 Pulling latest code from GitHub..."
git pull origin main

# Change to the web directory for Next.js operations
cd /var/www/dacroq/web

# Install dependencies
log "📦 Installing dependencies..."
/home/bdatsko/.npm-global/bin/pnpm install --frozen-lockfile

# Build the application
log "🔨 Building application..."
/home/bdatsko/.npm-global/bin/pnpm build

# Restart PM2 processes
log "🔄 Restarting PM2 processes..."
/home/bdatsko/.npm-global/bin/pm2 restart dacroq-web --update-env

log "✅ Deployment completed successfully!"
