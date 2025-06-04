#!/bin/bash

# Dacroq API CLI Helper Script
# Usage: ./dacroq-cli.sh [start|stop|status|logs|restart]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_SCRIPT="$SCRIPT_DIR/app.py"
LOG_FILE="$SCRIPT_DIR/dacroq_api.log"

case "$1" in
    start)
        echo "🚀 Starting Dacroq API daemon..."
        cd "$SCRIPT_DIR"
        python3 app.py
        ;;
    stop)
        echo "🛑 Stopping Dacroq API daemon..."
        cd "$SCRIPT_DIR"
        python3 app.py --stop
        ;;
    status)
        echo "📊 Checking Dacroq API daemon status..."
        cd "$SCRIPT_DIR"
        python3 app.py --status
        ;;
    logs)
        echo "📋 Showing Dacroq API logs (Ctrl+C to exit)..."
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "❌ Log file not found: $LOG_FILE"
            echo "💡 Start the daemon first with: ./dacroq-cli.sh start"
        fi
        ;;
    restart)
        echo "🔄 Restarting Dacroq API daemon..."
        cd "$SCRIPT_DIR"
        python3 app.py --stop
        sleep 2
        python3 app.py
        ;;
    foreground|debug)
        echo "🔧 Starting Dacroq API in foreground mode (debugging)..."
        cd "$SCRIPT_DIR"
        python3 app.py --foreground
        ;;
    *)
        echo "Dacroq API Management CLI"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start      Start the API daemon"
        echo "  stop       Stop the API daemon"
        echo "  status     Check daemon status"
        echo "  logs       View daemon logs (tail -f)"
        echo "  restart    Restart the daemon"
        echo "  foreground Run in foreground for debugging"
        echo ""
        echo "Examples:"
        echo "  $0 start         # Start daemon"
        echo "  $0 logs          # Watch logs"
        echo "  $0 stop          # Stop daemon"
        echo ""
        exit 1
        ;;
esac 