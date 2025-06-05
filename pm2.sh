#!/bin/bash
# PM2 Management Script for Dacroq Platform

set -e

cd "$(dirname "$0")"

# Ensure PM2 is in PATH
export PATH="/home/bdatsko/.npm-global/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service names (hardware-api runs on separate lab server)
SERVICES=("data-api" "web-prod" "web-dev" "webhook")
CORE_SERVICES=("data-api" "web-prod" "webhook")

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}           Dacroq PM2 Manager${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_usage() {
    echo -e "${YELLOW}Usage: $0 <command> [service]${NC}"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo "  start [service]     - Start service(s) - defaults to development mode"
    echo "  stop [service]      - Stop service(s)"
    echo "  restart [service]   - Restart service(s)"
    echo "  status              - Show status of all services"
    echo "  logs [service]      - Show logs (default: all services)"
    echo "  prod                - Start production services (data-api, web-prod, webhook)"
    echo "  dev                 - Start development services (data-api, web-dev)"
    echo "  clean               - Stop all services and clean PM2"
    echo "  reload              - Reload PM2 configuration"
    echo ""
    echo -e "${GREEN}Services:${NC}"
    echo "  data-api           - Data API (Port 8001) - Database, auth, test storage"
    echo "  web-prod           - Frontend Production (Port 3000) - Optimized build"
    echo "  web-dev            - Frontend Development (Port 3001) - Hot reloading"
    echo "  webhook            - GitHub webhook for deployments"
    echo ""
    echo -e "${YELLOW}Note: Hardware API runs on separate Raspberry Pi lab server${NC}"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo "  $0 start                   # Start development services (default)"
    echo "  $0 prod                    # Start production services"
    echo "  $0 dev                     # Start development services (explicit)"
    echo "  $0 start data-api          # Start only data API"
    echo "  $0 restart web-prod        # Restart production frontend"
    echo "  $0 logs data-api           # Show data API logs"
    echo "  $0 status                  # Show all service status"
}

check_service() {
    local service=$1
    if [[ ! " ${SERVICES[@]} " =~ " ${service} " ]]; then
        echo -e "${RED}❌ Unknown service: $service${NC}"
        echo -e "${YELLOW}Available services: ${SERVICES[*]}${NC}"
        exit 1
    fi
}

start_service() {
    local service=$1
    if [ -n "$service" ]; then
        check_service "$service"
        echo -e "${GREEN}🚀 Starting $service...${NC}"
        pm2 start ecosystem.config.js --only "$service"
    else
        echo -e "${BLUE}🔧 No service specified - starting development mode...${NC}"
        echo -e "${YELLOW}(Use './pm2.sh prod' for production or './pm2.sh start <service>' for individual services)${NC}"
        start_development
    fi
}

stop_service() {
    local service=$1
    if [ -n "$service" ]; then
        check_service "$service"
        echo -e "${YELLOW}🛑 Stopping $service...${NC}"
        pm2 stop "$service" 2>/dev/null || echo -e "${YELLOW}⚠️ $service was not running${NC}"
    else
        echo -e "${YELLOW}🛑 Stopping all services...${NC}"
        pm2 stop all 2>/dev/null || echo -e "${YELLOW}⚠️ No services were running${NC}"
    fi
}

restart_service() {
    local service=$1
    if [ -n "$service" ]; then
        check_service "$service"
        echo -e "${BLUE}🔄 Restarting $service...${NC}"
        pm2 restart "$service"
    else
        echo -e "${BLUE}🔄 Restarting all services...${NC}"
        pm2 restart all
    fi
}

show_status() {
    echo -e "${BLUE}📊 Service Status:${NC}"
    pm2 status
    echo ""
    echo -e "${BLUE}🌐 Service URLs:${NC}"
    echo -e "${GREEN}  • Frontend (Prod):  https://dacroq.eecs.umich.edu${NC}"
    echo -e "${GREEN}  • Frontend (Dev):   http://localhost:3001${NC}"
    echo -e "${GREEN}  • Data API:         http://localhost:8001${NC}"
    echo -e "${GREEN}  • Hardware API:     https://dacroq.eecs.umich.edu/api/hardware/* (lab server)${NC}"
}

show_logs() {
    local service=$1
    if [ -n "$service" ]; then
        check_service "$service"
        echo -e "${BLUE}📋 Showing logs for $service...${NC}"
        pm2 logs "$service" --lines 50
    else
        echo -e "${BLUE}📋 Showing logs for all services...${NC}"
        pm2 logs --lines 20
    fi
}

start_production() {
    echo -e "${GREEN}🏭 Starting production services...${NC}"
    echo -e "${YELLOW}Services: data-api, web-prod, webhook${NC}"
    
    # Stop and delete dev services if running
    echo -e "${YELLOW}🔄 Ensuring development web service is stopped...${NC}"
    pm2 stop web-dev 2>/dev/null || true
    pm2 delete web-dev 2>/dev/null || true
    
    # Start core production services
    for service in "${CORE_SERVICES[@]}"; do
        echo -e "${GREEN}🚀 Starting $service...${NC}"
        pm2 start ecosystem.config.js --only "$service"
        sleep 1
    done
    
    echo -e "${GREEN}✅ Production services started!${NC}"
    echo -e "${YELLOW}⚠️ Hardware API should be running on lab server (port 8000)${NC}"
    show_status
}

start_development() {
    echo -e "${BLUE}🔧 Starting development services...${NC}"
    echo -e "${YELLOW}Services: data-api, web-dev${NC}"
    
    # Stop and delete production web if running/errored
    echo -e "${YELLOW}🔄 Ensuring production web service is stopped...${NC}"
    pm2 stop web-prod 2>/dev/null || true
    pm2 delete web-prod 2>/dev/null || true
    
    # Start development services
    echo -e "${GREEN}🚀 Starting data-api...${NC}"
    pm2 start ecosystem.config.js --only "data-api"
    sleep 1
    
    echo -e "${GREEN}🚀 Starting web-dev...${NC}"
    pm2 start ecosystem.config.js --only "web-dev"
    sleep 1
    
    echo -e "${BLUE}✅ Development services started!${NC}"
    echo -e "${YELLOW}⚠️ Development frontend running on port 3001${NC}"
    echo -e "${YELLOW}⚠️ Hardware API should be running on lab server (port 8000)${NC}"
    show_status
}

clean_pm2() {
    echo -e "${RED}🧹 Cleaning PM2...${NC}"
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    echo -e "${GREEN}✅ PM2 cleaned${NC}"
}

reload_config() {
    echo -e "${BLUE}🔄 Reloading PM2 configuration...${NC}"
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    pm2 start ecosystem.config.js
    echo -e "${GREEN}✅ Configuration reloaded${NC}"
}

# Main command processing
print_header

case "$1" in
    "start")
        start_service "$2"
        ;;
    "stop")
        stop_service "$2"
        ;;
    "restart")
        restart_service "$2"
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs "$2"
        ;;
    "prod")
        start_production
        ;;
    "dev")
        start_development
        ;;
    "clean")
        clean_pm2
        ;;
    "reload")
        reload_config
        ;;
    *)
        print_usage
        exit 1
        ;;
esac 