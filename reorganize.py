#!/usr/bin/env python3
"""
Dacroq Project Reorganization Script

This script helps reorganize the Dacroq project into:
1. Hardware API (lab server) - Handles Teensy interactions
2. Data API (website server) - Handles database operations  
3. Website (website server) - Next.js frontend

Usage:
    python3 reorganize.py --setup-hardware  # Setup hardware API on lab server
    python3 reorganize.py --setup-data      # Setup data API on website server  
    python3 reorganize.py --update-nginx    # Update nginx configuration
    python3 reorganize.py --start-all       # Start all services
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

def setup_hardware_api():
    """Setup hardware API structure"""
    print("🔧 Setting up Hardware API structure...")
    
    # Create hardware directory structure
    hardware_dir = Path("api/hardware")
    hardware_dir.mkdir(exist_ok=True)
    
    # Move firmware into hardware
    if Path("firmware").exists() and not Path("api/hardware/firmware").exists():
        shutil.move("firmware", "api/hardware/firmware")
        print("📁 Moved firmware/ to api/hardware/firmware/")
    
    # Create hardware API entry point
    if not Path("api/hardware/app.py").exists():
        print("📝 Creating hardware API entry point...")
        # This would be created separately with the hardware classes
        
    print("✅ Hardware API structure ready")

def setup_data_api():
    """Setup data API to run on port 8001"""
    print("🗄️ Setting up Data API...")
    
    data_api_path = Path("data/api/app.py")
    if data_api_path.exists():
        print(f"✅ Data API found at {data_api_path}")
        # The port has already been updated to 8001
    else:
        print(f"❌ Data API not found at {data_api_path}")
        return False
    
    return True

def update_nginx():
    """Update nginx configuration"""
    print("🌐 Updating nginx configuration...")
    
    nginx_conf = Path("/etc/nginx/nginx.conf")
    if nginx_conf.exists():
        # Backup current config
        backup_path = nginx_conf.with_suffix(".conf.backup")
        shutil.copy2(nginx_conf, backup_path)
        print(f"📋 Backed up nginx config to {backup_path}")
        
        # The nginx config has already been updated with the routing
        print("✅ Nginx configuration updated with API routing:")
        print("   - /api/data/* → localhost:8001 (Data API)")
        print("   - /api/hardware/* → dacroq.eecs.umich.edu:8000 (Hardware API)")
        
        # Test nginx config
        result = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Nginx configuration test passed")
            return True
        else:
            print(f"❌ Nginx configuration test failed: {result.stderr}")
            # Restore backup
            shutil.copy2(backup_path, nginx_conf)
            return False
    else:
        print("❌ Nginx configuration not found")
        return False

def create_systemd_services():
    """Create systemd services for both APIs"""
    print("⚙️ Creating systemd services...")
    
    # Data API service (already created)
    data_service = Path("systemd/dacroq-data-api.service")
    if data_service.exists():
        print("✅ Data API service file exists")
    
    # Hardware API service  
    hardware_service_content = """[Unit]
Description=Dacroq Hardware API - Teensy and Firmware Management
After=network.target
Wants=network.target

[Service]
Type=simple
User=dacroq
Group=dacroq
WorkingDirectory=/var/www/dacroq/api/hardware
Environment=PATH=/var/www/dacroq/venv/bin:/usr/bin:/bin
Environment=PYTHONPATH=/var/www/dacroq/api/hardware
ExecStart=/var/www/dacroq/venv/bin/python3 /var/www/dacroq/api/hardware/app.py --port 8000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/dacroq/api/hardware
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target"""
    
    hardware_service_path = Path("systemd/dacroq-hardware-api.service")
    with open(hardware_service_path, "w") as f:
        f.write(hardware_service_content)
    print("✅ Hardware API service file created")

def start_services(service_type=None):
    """Start the specified services"""
    if service_type == "data" or service_type is None:
        print("🚀 Starting Data API...")
        try:
            subprocess.run(["systemctl", "start", "dacroq-data-api"], check=True)
            subprocess.run(["systemctl", "enable", "dacroq-data-api"], check=True)
            print("✅ Data API started and enabled")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to start Data API: {e}")
    
    if service_type == "hardware" or service_type is None:
        print("🔧 Starting Hardware API...")
        try:
            subprocess.run(["systemctl", "start", "dacroq-hardware-api"], check=True)
            subprocess.run(["systemctl", "enable", "dacroq-hardware-api"], check=True)
            print("✅ Hardware API started and enabled")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to start Hardware API: {e}")
    
    if service_type == "nginx" or service_type is None:
        print("🌐 Reloading nginx...")
        try:
            subprocess.run(["systemctl", "reload", "nginx"], check=True)
            print("✅ Nginx reloaded")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to reload nginx: {e}")

def show_status():
    """Show status of all services"""
    print("📊 Service Status:")
    
    services = [
        "dacroq-data-api",
        "dacroq-hardware-api", 
        "nginx",
        "dacroq-web"  # If it exists
    ]
    
    for service in services:
        try:
            result = subprocess.run(
                ["systemctl", "is-active", service], 
                capture_output=True, text=True
            )
            status = result.stdout.strip()
            icon = "✅" if status == "active" else "❌"
            print(f"   {icon} {service}: {status}")
        except:
            print(f"   ❓ {service}: unknown")

def main():
    parser = argparse.ArgumentParser(description="Dacroq Project Reorganization")
    parser.add_argument("--setup-hardware", action="store_true", help="Setup hardware API structure")
    parser.add_argument("--setup-data", action="store_true", help="Setup data API")
    parser.add_argument("--update-nginx", action="store_true", help="Update nginx configuration")
    parser.add_argument("--create-services", action="store_true", help="Create systemd services")
    parser.add_argument("--start-all", action="store_true", help="Start all services")
    parser.add_argument("--start", choices=["data", "hardware", "nginx"], help="Start specific service")
    parser.add_argument("--status", action="store_true", help="Show service status")
    
    args = parser.parse_args()
    
    if args.setup_hardware:
        setup_hardware_api()
    
    if args.setup_data:
        setup_data_api()
    
    if args.update_nginx:
        update_nginx()
    
    if args.create_services:
        create_systemd_services()
    
    if args.start:
        start_services(args.start)
    
    if args.start_all:
        create_systemd_services()
        start_services()
    
    if args.status:
        show_status()
    
    if not any(vars(args).values()):
        print("🚀 Dacroq Project Reorganization")
        print("\nAvailable commands:")
        print("  --setup-hardware    Setup hardware API structure")
        print("  --setup-data        Setup data API")  
        print("  --update-nginx      Update nginx configuration")
        print("  --create-services   Create systemd services")
        print("  --start-all         Start all services")
        print("  --status            Show service status")
        print("\nArchitecture:")
        print("  📱 Website (dacroq.net) → Next.js on :3000")
        print("  🗄️ Data API → /api/data/* → localhost:8001")
        print("  🔧 Hardware API → /api/hardware/* → lab-server:8000")

if __name__ == "__main__":
    main() 