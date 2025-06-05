#!/bin/bash

# Dacroq Deployment Setup Script
# This script sets up the complete deployment environment for the Dacroq application
# Run this script as the deployment user (not root)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Do not run this script as root. Run as the deployment user."
    exit 1
fi

print_status "Starting Dacroq deployment setup..."

# Variables
REPO_URL="https://github.com/bendatsko/dacroq.git"
DEPLOY_DIR="/var/www/dacroq"
USER=$(whoami)
HOME_DIR=$(eval echo ~$USER)

# Check if Git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Step 1: Clone repository
print_status "Cloning repository..."
if [ -d "$DEPLOY_DIR" ]; then
    print_warning "Directory $DEPLOY_DIR already exists. Backing up..."
    sudo mv "$DEPLOY_DIR" "${DEPLOY_DIR}.backup.$(date +%s)"
fi
sudo git clone "$REPO_URL" "$DEPLOY_DIR"
sudo chown -R $USER:$USER "$DEPLOY_DIR"
print_success "Repository cloned to $DEPLOY_DIR"

# Step 2: Install global packages
print_status "Installing global npm packages..."
if [ ! -d "$HOME_DIR/.npm-global" ]; then
    mkdir -p "$HOME_DIR/.npm-global"
    npm config set prefix "$HOME_DIR/.npm-global"
fi

# Add npm global bin to PATH if not already there
if [[ ":$PATH:" != *":$HOME_DIR/.npm-global/bin:"* ]]; then
    echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> "$HOME_DIR/.bashrc"
    export PATH="$HOME_DIR/.npm-global/bin:$PATH"
fi

npm install -g pnpm pm2
print_success "Global packages installed"

# Step 3: Install application dependencies
print_status "Installing application dependencies..."
cd "$DEPLOY_DIR/web"
"$HOME_DIR/.npm-global/bin/pnpm" install --frozen-lockfile
print_success "Dependencies installed"

# Step 4: Build application
print_status "Building Next.js application..."
"$HOME_DIR/.npm-global/bin/pnpm" build
print_success "Application built"

# Step 5: Make deployment script executable
print_status "Setting up deployment script..."
chmod +x "$DEPLOY_DIR/deploy.sh"
print_success "Deployment script configured"

# Step 6: Start PM2 processes
print_status "Starting PM2 processes..."
cd "$DEPLOY_DIR"
"$HOME_DIR/.npm-global/bin/pm2" start ecosystem.config.js
print_success "PM2 processes started"

# Step 7: Save PM2 configuration
print_status "Saving PM2 configuration..."
"$HOME_DIR/.npm-global/bin/pm2" save
print_success "PM2 configuration saved"

# Step 8: Setup PM2 startup (requires sudo)
print_status "Setting up PM2 startup script..."
print_warning "The next step requires sudo privileges to set up automatic startup."
echo "Please run the following command manually:"
echo "sudo env PATH=\$PATH:/usr/bin $HOME_DIR/.npm-global/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME_DIR"

# Step 9: Display status
print_status "Checking process status..."
"$HOME_DIR/.npm-global/bin/pm2" status

print_success "Dacroq deployment setup completed!"
echo ""
echo "Next steps:"
echo "1. Configure nginx with SSL certificates"
echo "2. Set up GitHub webhook with secret: dacroq-deployment-secret-2024"
echo "3. Test the deployment by pushing to the main branch"
echo ""
echo "Useful commands:"
echo "  pm2 status                    # Check process status"
echo "  pm2 logs                      # View logs"
echo "  pm2 restart dacroq-web        # Restart web app"
echo "  pm2 restart dacroq-webhook    # Restart webhook"
echo "  ./deploy.sh                   # Manual deployment"
echo ""
echo "Application URLs:"
echo "  Web app:    http://localhost:3000"
echo "  Webhook:    http://localhost:9000/health"
echo ""
print_success "Setup complete! 🚀" 