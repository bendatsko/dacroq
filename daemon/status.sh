#!/bin/bash

# Check if the dacroq session exists
if tmux has-session -t dacroq 2>/dev/null; then
    echo "✅ Dacroq daemon is RUNNING"
    echo
    echo "Session details:"
    tmux list-sessions | grep dacroq
    echo
    echo "Process information:"
    # Get the Python process ID
    PID=$(pgrep -f "python3 app.py")
    if [ ! -z "$PID" ]; then
        echo "PID: $PID"
        echo "CPU usage: $(ps -p $PID -o %cpu | tail -n 1)%"
        echo "Memory usage: $(ps -p $PID -o %mem | tail -n 1)%"
        echo "Running since: $(ps -p $PID -o lstart | tail -n 1)"
    else
        echo "Warning: Session exists but process not found"
    fi
    echo
    echo "Commands:"
    echo "  View logs: tmux attach -t dacroq"
    echo "  Stop daemon: ./stop.sh"
else
    echo "❌ Dacroq daemon is NOT running"
    echo
    echo "To start the daemon, run: ./start.sh"
fi 