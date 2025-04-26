#!/bin/bash

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Status file that frontend can monitor
STATUS_FILE="/tmp/ksat_restart_status"

# Function to log messages and update status
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$1" > $STATUS_FILE
}

log_message "STARTING"

# 1. Stop the service
log_message "STOPPING"
sudo pkill -9 -f "python.*app.py" 2>/dev/null
sleep 2

# 2. Kill processes
PYTHON_PIDS=$(pgrep -f "python.*app.py")
if [ ! -z "$PYTHON_PIDS" ]; then
    for PID in $PYTHON_PIDS; do
        kill -9 $PID 2>/dev/null
    done
fi

# 3. Start the service
log_message "STARTING"
if [ -f "/etc/systemd/system/ksat-api.service" ]; then
    sudo systemctl start ksat-api
else
    cd "$SCRIPT_DIR/.."
    nohup python3 app.py >/dev/null 2>&1 &
fi

# 4. Verify
sleep 2
NEW_PID=$(pgrep -f "python.*app.py")
if [ ! -z "$NEW_PID" ]; then
    log_message "COMPLETE"
    exit 0
else
    log_message "FAILED"
    exit 1
fi