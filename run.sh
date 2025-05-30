#!/bin/bash

# =============================================================================
# |                              DACROQ RUN SCRIPT                            |
# |                         Enterprise Development Suite                       |
# =============================================================================

set -e  # Exit on any error

# ─────────────────────────────────────────────────────────────────────────────
# Configuration & Constants
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
WEB_DIR="$PROJECT_ROOT/web"
DAEMON_DIR="$PROJECT_ROOT/daemon"
HARDWARE_DIR="$PROJECT_ROOT/hardware"

# Colors for beautiful terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Status indicators
CHECK_MARK="✓"
CROSS_MARK="✗"
WARNING_MARK="⚠"
INFO_MARK="ℹ"
ROCKET="🚀"
GEAR="⚙"
DATABASE="🗄"
MONITOR="📊"

# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${BLUE}╭─────────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${BLUE}│${WHITE}                         DACROQ SYSTEM                          ${BLUE}│${NC}"
    echo -e "${BLUE}│${GRAY}              Hardware Acceleration Platform                    ${BLUE}│${NC}"
    echo -e "${BLUE}╰─────────────────────────────────────────────────────────────────╯${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}▶ $1${NC}"
    echo -e "${GRAY}────────────────────────────────────────────────────────${NC}"
}

print_status() {
    local status=$1
    local message=$2
    local color=$3
    
    case $status in
        "success") echo -e "  ${GREEN}${CHECK_MARK}${NC} ${message}" ;;
        "error")   echo -e "  ${RED}${CROSS_MARK}${NC} ${message}" ;;
        "warning") echo -e "  ${YELLOW}${WARNING_MARK}${NC} ${message}" ;;
        "info")    echo -e "  ${BLUE}${INFO_MARK}${NC} ${message}" ;;
        *)         echo -e "  ${color}${status}${NC} ${message}" ;;
    esac
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_status "success" "$1 is installed"
        return 0
    else
        print_status "error" "$1 is not installed"
        return 1
    fi
}

check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :"$port" &> /dev/null; then
        print_status "success" "$service is running on port $port"
        return 0
    else
        print_status "warning" "$service is not running on port $port"
        return 1
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# System Status Functions
# ─────────────────────────────────────────────────────────────────────────────

check_system_status() {
    print_section "${MONITOR} System Status Check"
    
    # Check operating system
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "info" "Running on macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "info" "Running on Linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        print_status "info" "Running on Windows"
    else
        print_status "warning" "Unknown operating system: $OSTYPE"
    fi
    
    # Check required dependencies
    check_command "node"
    check_command "pnpm"
    check_command "python3"
    check_command "pip3"
    
    # Check optional dependencies
    check_command "git"
    check_command "docker" || print_status "info" "Docker not required but recommended"
}

check_services_status() {
    print_section "${GEAR} Service Status"
    
    # Check if web server is running
    check_port 3000 "Web Frontend (Next.js)"
    
    # Check if daemon is running
    check_port 8000 "Python Daemon API" || check_port 5000 "Python Daemon API"
    
    # Check if database exists
    if [[ -f "$PROJECT_ROOT/dacroq.db" ]]; then
        print_status "success" "SQLite database exists"
    else
        print_status "warning" "SQLite database not found"
    fi
}

check_database_connection() {
    print_section "${DATABASE} Database Connection"
    
    if [[ -f "$PROJECT_ROOT/dacroq.db" ]]; then
        # Try to query the database
        if command -v sqlite3 &> /dev/null; then
            local table_count=$(sqlite3 "$PROJECT_ROOT/dacroq.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
            if [[ "$table_count" -gt 0 ]]; then
                print_status "success" "Database connection successful ($table_count tables found)"
            else
                print_status "warning" "Database exists but appears empty"
            fi
        else
            print_status "warning" "sqlite3 command not available for database verification"
        fi
    else
        print_status "error" "Database file not found"
        print_status "info" "Run './run.sh init' to initialize the database"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Installation Functions
# ─────────────────────────────────────────────────────────────────────────────

install_dependencies() {
    print_section "${GEAR} Installing Dependencies"
    
    # Install web dependencies
    if [[ -d "$WEB_DIR" ]]; then
        print_status "info" "Installing web dependencies..."
        cd "$WEB_DIR"
        if command -v pnpm &> /dev/null; then
            pnpm install
            print_status "success" "Web dependencies installed"
        else
            print_status "error" "pnpm not found. Please install pnpm first."
            exit 1
        fi
        cd "$PROJECT_ROOT"
    fi
    
    # Install daemon dependencies
    if [[ -d "$DAEMON_DIR" ]]; then
        print_status "info" "Installing daemon dependencies..."
        cd "$DAEMON_DIR"
        if [[ -f "requirements.txt" ]]; then
            print_status "info" "Current Python: $(which python3)"
            
            # Install using --break-system-packages to override protection
            python3 -m pip install --break-system-packages -r requirements.txt
            print_status "success" "Daemon dependencies installed"
        else
            print_status "warning" "No requirements.txt found in daemon directory"
        fi
        cd "$PROJECT_ROOT"
    fi
}

initialize_project() {
    print_section "${ROCKET} Initializing Project"
    
    # Create database if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/dacroq.db" ]]; then
        print_status "info" "Creating SQLite database..."
        touch "$PROJECT_ROOT/dacroq.db"
        print_status "success" "Database file created"
    fi
    
    # Initialize database schema (if daemon has initialization script)
    if [[ -f "$DAEMON_DIR/init_db.py" ]]; then
        print_status "info" "Initializing database schema..."
        cd "$DAEMON_DIR"
        python3 init_db.py
        cd "$PROJECT_ROOT"
        print_status "success" "Database schema initialized"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Service Management Functions
# ─────────────────────────────────────────────────────────────────────────────

start_web() {
    print_section "${ROCKET} Starting Web Frontend"
    
    if check_port 3000 "Web Frontend" &> /dev/null; then
        print_status "warning" "Web frontend is already running on port 3000"
        return 0
    fi
    
    cd "$WEB_DIR"
    print_status "info" "Starting Next.js development server..."
    
    # Start in background and capture PID
    nohup pnpm dev > "../.web.log" 2>&1 &
    WEB_PID=$!
    echo "$WEB_PID" > "$PROJECT_ROOT/.web.pid"
    
    # Wait a moment and check if it started
    sleep 3
    if check_port 3000 "Web Frontend" &> /dev/null; then
        print_status "success" "Web frontend started successfully (PID: $WEB_PID)"
        print_status "info" "Access at: http://localhost:3000"
    else
        print_status "error" "Failed to start web frontend"
        rm -f "$PROJECT_ROOT/.web.pid"
    fi
    
    cd "$PROJECT_ROOT"
}

start_daemon() {
    print_section "${GEAR} Starting Python Daemon"
    
    if check_port 8000 "Python Daemon" &> /dev/null; then
        print_status "warning" "Python daemon is already running on port 8000"
        return 0
    fi
    
    if [[ -f "$DAEMON_DIR/app.py" ]]; then
        cd "$DAEMON_DIR"
        print_status "info" "Starting Python daemon..."
        
        # Check if we're in a virtual environment and activate if needed
        if [[ -z "$VIRTUAL_ENV" ]] && [[ -f "../.venv/bin/activate" ]]; then
            print_status "info" "Activating virtual environment..."
            source ../.venv/bin/activate
        fi
        
        # Start in background and capture PID
        nohup python3 app.py > "../.daemon.log" 2>&1 &
        DAEMON_PID=$!
        echo "$DAEMON_PID" > "$PROJECT_ROOT/.daemon.pid"
        
        # Wait a moment and check if it started
        sleep 3
        if check_port 8000 "Python Daemon" &> /dev/null; then
            print_status "success" "Python daemon started successfully (PID: $DAEMON_PID)"
            print_status "info" "API available at: http://localhost:8000"
        else
            print_status "error" "Failed to start Python daemon"
            print_status "info" "Check logs: tail -f .daemon.log"
            rm -f "$PROJECT_ROOT/.daemon.pid"
        fi
        
        cd "$PROJECT_ROOT"
    else
        print_status "error" "Daemon app.py not found"
    fi
}

start_all() {
    print_section "${ROCKET} Starting All Services"
    start_daemon
    sleep 2
    start_web
    
    echo ""
    print_status "success" "All services started in background!"
    print_status "info" "Web UI: http://localhost:3000"
    print_status "info" "API: http://localhost:8000"
    echo ""
    print_status "info" "Starting monitoring mode... (Press Ctrl+C to exit monitoring only)"
    echo ""
    
    # Start monitoring but allow user to exit with Ctrl+C
    monitor_services_only
}

reload_all() {
    print_section "🔄 Reloading All Services"
    
    print_status "info" "Stopping all services..."
    stop_services_quiet
    
    sleep 2
    
    print_status "info" "Starting services in sequence..."
    start_daemon
    sleep 3
    start_web
    
    echo ""
    print_status "success" "System reloaded successfully!"
    print_status "info" "Web UI: http://localhost:3000"
    print_status "info" "API: http://localhost:8000"
    echo ""
    print_status "info" "Starting monitoring mode... (Press Ctrl+C to exit monitoring only)"
    echo ""
    
    # Start monitoring but allow user to exit with Ctrl+C
    monitor_services_only
}

stop_services() {
    print_section "🛑 Stopping Services"
    
    # Create maintenance page
    create_maintenance_page
    
    stop_services_quiet
    
    print_status "success" "All services stopped and maintenance mode activated"
    print_status "info" "To restart: ./run.sh start"
}

stop_services_quiet() {
    # Stop web frontend
    if [[ -f "$PROJECT_ROOT/.web.pid" ]]; then
        local web_pid=$(cat "$PROJECT_ROOT/.web.pid")
        if kill -0 "$web_pid" 2>/dev/null; then
            kill "$web_pid" 2>/dev/null
            print_status "success" "Web frontend stopped (PID: $web_pid)"
        fi
        rm -f "$PROJECT_ROOT/.web.pid"
    fi
    
    # Stop daemon
    if [[ -f "$PROJECT_ROOT/.daemon.pid" ]]; then
        local daemon_pid=$(cat "$PROJECT_ROOT/.daemon.pid")
        if kill -0 "$daemon_pid" 2>/dev/null; then
            kill "$daemon_pid" 2>/dev/null
            print_status "success" "Python daemon stopped (PID: $daemon_pid)"
        fi
        rm -f "$PROJECT_ROOT/.daemon.pid"
    fi
    
    # Kill any remaining processes on our ports
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "python.*main.py" 2>/dev/null || true
    
    # Clean up log files
    rm -f "$PROJECT_ROOT/.web.log" "$PROJECT_ROOT/.daemon.log"
}

create_maintenance_page() {
    print_status "info" "Creating maintenance page..."
    
    # Create a simple maintenance HTML page
    cat > "$PROJECT_ROOT/maintenance.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dacroq - Maintenance</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
        }
        .container {
            max-width: 600px;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Dacroq Maintenance</h1>
        <p>The hardware acceleration platform is temporarily offline for maintenance.</p>
        <div class="spinner"></div>
        <p>Please check back in a few moments.</p>
        <small style="opacity: 0.7;">University of Michigan - MICL Lab</small>
    </div>
</body>
</html>
EOF
    
    print_status "success" "Maintenance page created"
}

# ─────────────────────────────────────────────────────────────────────────────
# Enhanced Monitoring Functions
# ─────────────────────────────────────────────────────────────────────────────

monitor_services_only() {
    # This is the monitoring that can be exited with Ctrl+C while keeping services running
    local monitoring=true
    
    # Trap Ctrl+C to exit monitoring gracefully
    trap 'monitoring=false; echo ""; print_status "info" "Exiting monitoring mode. Services continue running in background."; echo ""; return 0' SIGINT
    
    while $monitoring; do
        clear
        print_header
        
        echo -e "${WHITE}Real-time System Status${NC}"
        echo -e "${GRAY}$(date) - Press Ctrl+C to exit monitoring${NC}"
        echo ""
        
        # Service status with PID info
        echo -e "${CYAN}Services:${NC}"
        if check_port 3000 "Web Frontend" &> /dev/null; then
            local web_pid=""
            if [[ -f "$PROJECT_ROOT/.web.pid" ]]; then
                web_pid=" (PID: $(cat "$PROJECT_ROOT/.web.pid" 2>/dev/null || echo "unknown"))"
            fi
            echo -e "  ${GREEN}●${NC} Web Frontend${web_pid} - http://localhost:3000"
        else
            echo -e "  ${RED}●${NC} Web Frontend (offline)"
        fi
        
        if check_port 8000 "Python Daemon" &> /dev/null; then
            local daemon_pid=""
            if [[ -f "$PROJECT_ROOT/.daemon.pid" ]]; then
                daemon_pid=" (PID: $(cat "$PROJECT_ROOT/.daemon.pid" 2>/dev/null || echo "unknown"))"
            fi
            echo -e "  ${GREEN}●${NC} Python Daemon${daemon_pid} - http://localhost:8000"
        else
            echo -e "  ${RED}●${NC} Python Daemon (offline)"
        fi
        
        # Database status
        echo ""
        echo -e "${CYAN}Database:${NC}"
        if [[ -f "$PROJECT_ROOT/dacroq.db" ]]; then
            local db_size=$(ls -lh "$PROJECT_ROOT/dacroq.db" 2>/dev/null | awk '{print $5}' || echo "unknown")
            echo -e "  ${GREEN}●${NC} SQLite Database (${db_size})"
        else
            echo -e "  ${RED}●${NC} SQLite Database (missing)"
        fi
        
        # Hardware status
        echo ""
        echo -e "${CYAN}Hardware:${NC}"
        local usb_devices=$(lsusb 2>/dev/null | grep -i teensy | wc -l || echo "0")
        if [[ "$usb_devices" -gt 0 ]]; then
            echo -e "  ${GREEN}●${NC} Teensy devices detected: $usb_devices"
        else
            echo -e "  ${YELLOW}●${NC} No Teensy devices detected"
        fi
        
        # Log tails if available
        echo ""
        echo -e "${CYAN}Recent Activity:${NC}"
        if [[ -f "$PROJECT_ROOT/.web.log" ]]; then
            echo -e "${GRAY}Web Frontend:${NC}"
            tail -n 2 "$PROJECT_ROOT/.web.log" 2>/dev/null | sed 's/^/  /' || echo "  No recent activity"
        fi
        if [[ -f "$PROJECT_ROOT/.daemon.log" ]]; then
            echo -e "${GRAY}Python Daemon:${NC}"
            tail -n 2 "$PROJECT_ROOT/.daemon.log" 2>/dev/null | sed 's/^/  /' || echo "  No recent activity"
        fi
        
        echo ""
        echo -e "${GRAY}Monitoring... Press Ctrl+C to exit${NC}"
        
        sleep 5
    done
    
    # Reset trap
    trap - SIGINT
}

# ─────────────────────────────────────────────────────────────────────────────
# Terminal Editor Function
# ─────────────────────────────────────────────────────────────────────────────

terminal_editor() {
    print_section "💻 Terminal Development Environment"
    
    # Check if tmux is available
    if ! command -v tmux &> /dev/null; then
        print_status "error" "tmux is required for terminal editor mode"
        print_status "info" "Install tmux: brew install tmux (macOS) or apt-get install tmux (Linux)"
        return 1
    fi
    
    print_status "info" "Starting terminal development environment..."
    
    # Create tmux session with split panes
    tmux new-session -d -s dacroq -x 120 -y 40
    
    # Split into three panes
    tmux split-window -h -t dacroq
    tmux split-window -v -t dacroq:0.1
    
    # Setup panes
    tmux send-keys -t dacroq:0.0 "cd $WEB_DIR && echo 'Frontend Ready. Run: pnpm dev'" Enter
    tmux send-keys -t dacroq:0.1 "cd $DAEMON_DIR && echo 'Backend Ready. Run: python main.py'" Enter
    tmux send-keys -t dacroq:0.2 "cd $PROJECT_ROOT && echo 'Project Root. Run: ./run.sh monitor'" Enter
    
    # Set pane titles
    tmux select-pane -t dacroq:0.0 -T "Frontend"
    tmux select-pane -t dacroq:0.1 -T "Backend" 
    tmux select-pane -t dacroq:0.2 -T "Monitor"
    
    # Attach to session
    tmux attach-session -t dacroq
}

# ─────────────────────────────────────────────────────────────────────────────
# Help Functions
# ─────────────────────────────────────────────────────────────────────────────

show_help() {
    print_header
    
    echo -e "${WHITE}Usage:${NC} ./run.sh [command]"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo ""
    echo -e "${WHITE}  System Management:${NC}"
    echo -e "    ${GREEN}status${NC}      Show complete system status"
    echo -e "    ${GREEN}init${NC}        Initialize project and database"
    echo -e "    ${GREEN}install${NC}     Install all dependencies"
    echo ""
    echo -e "${WHITE}  Service Control:${NC}"
    echo -e "    ${GREEN}start${NC}       Start all services (web + daemon) with monitoring"
    echo -e "    ${GREEN}web${NC}         Start web frontend only"
    echo -e "    ${GREEN}daemon${NC}      Start daemon backend only"
    echo -e "    ${GREEN}reload${NC}      Restart all services (daemon first, then web)"
    echo -e "    ${GREEN}stop${NC}        Stop all services and activate maintenance mode"
    echo ""
    echo -e "${WHITE}  Development:${NC}"
    echo -e "    ${GREEN}dev${NC}         Start development mode (same as start)"
    echo -e "    ${GREEN}monitor${NC}     Real-time system monitoring (Ctrl+C to exit)"
    echo -e "    ${GREEN}editor${NC}      Terminal-based development environment"
    echo ""
    echo -e "${WHITE}  Database:${NC}"
    echo -e "    ${GREEN}db${NC}          Check database connection"
    echo ""
    echo -e "${WHITE}  Help:${NC}"
    echo -e "    ${GREEN}help${NC}        Show this help message"
    echo ""
    echo -e "${GRAY}Examples:${NC}"
    echo -e "  ${GRAY}./run.sh start      # Start all services with monitoring${NC}"
    echo -e "  ${GRAY}./run.sh reload     # Restart both services${NC}"
    echo -e "  ${GRAY}./run.sh monitor    # Monitor running services${NC}"
    echo -e "  ${GRAY}./run.sh stop       # Stop everything safely${NC}"
    echo ""
    echo -e "${WHITE}Notes:${NC}"
    echo -e "  - Services run in background, monitoring can be exited with Ctrl+C"
    echo -e "  - Use 'reload' to restart services without manual stop/start"
    echo -e "  - 'stop' creates a maintenance page and cleans up all processes"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Signal Handlers
# ─────────────────────────────────────────────────────────────────────────────

cleanup() {
    echo ""
    print_status "info" "Shutting down..."
    stop_services_quiet
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────────────────────────────
# Main Script Logic
# ─────────────────────────────────────────────────────────────────────────────

case "${1:-auto}" in
    "auto")
        # Default behavior: Full development workflow
        print_header
        print_section "🚀 Dacroq Development Workflow"
        print_status "info" "Running complete setup: stop → install → start → monitor"
        echo ""
        
        # Step 1: Stop any running services
        print_status "info" "Step 1/4: Stopping existing services..."
        stop_services_quiet
        
        # Step 2: Install dependencies
        print_status "info" "Step 2/4: Installing dependencies..."
        install_dependencies
        
        # Step 3: Start all services
        print_status "info" "Step 3/4: Starting services..."
        start_daemon
        sleep 3
        start_web
        
        # Step 4: Begin monitoring
        print_status "success" "Step 4/4: All services ready!"
        echo ""
        print_status "info" "Web UI: http://localhost:3000"
        print_status "info" "API: http://localhost:8000"
        echo ""
        print_status "info" "Starting monitoring mode... (Press Ctrl+C to exit monitoring only)"
        echo ""
        
        # Start monitoring but allow user to exit with Ctrl+C
        monitor_services_only
        ;;
    
    "status")
        print_header
        check_system_status
        check_services_status
        check_database_connection
        ;;
    
    "init")
        print_header
        initialize_project
        install_dependencies
        ;;
    
    "install")
        print_header
        install_dependencies
        ;;
    
    "start"|"dev")
        print_header
        start_all
        ;;
    
    "web")
        print_header
        start_web
        print_status "info" "Web frontend started. Use './run.sh monitor' to track status."
        ;;
    
    "daemon")
        print_header
        start_daemon
        print_status "info" "Daemon started. Use './run.sh monitor' to track status."
        ;;
    
    "reload")
        print_header
        reload_all
        ;;
    
    "stop")
        print_header
        stop_services
        ;;
    
    "monitor")
        print_header
        monitor_services_only
        ;;
    
    "editor")
        print_header
        terminal_editor
        ;;
    
    "db")
        print_header
        check_database_connection
        ;;
    
    "help"|*)
        show_help
        ;;
esac 