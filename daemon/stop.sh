#!/bin/bash

# Check if the dacroq session exists
if tmux has-session -t dacroq 2>/dev/null; then
    echo "Stopping Dacroq daemon..."
    
    # Send Ctrl+C to stop the Python process gracefully
    tmux send-keys -t dacroq C-c
    
    # Wait a moment for the process to stop
    sleep 2
    
    # Kill the tmux session
    tmux kill-session -t dacroq
    
    echo "Dacroq daemon stopped successfully"
    exit 0
else
    echo "No Dacroq daemon running"
    exit 1
fi 