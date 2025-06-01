#!/bin/bash

# Kill any existing dacroq session
tmux kill-session -t dacroq 2>/dev/null || true

# Wait a moment
sleep 1

# Create a new tmux session named 'dacroq' in detached mode
echo "Creating new tmux session..."
if ! tmux new-session -d -s dacroq; then
    echo "Failed to create tmux session"
    exit 1
fi

# Get the full path to the current directory
DAEMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Working directory: $DAEMON_DIR"

# Send the commands to the session
echo "Configuring tmux session..."
tmux send-keys -t dacroq "cd \"$DAEMON_DIR\"" C-m
tmux send-keys -t dacroq "source venv/bin/activate" C-m
tmux send-keys -t dacroq "python3 app.py" C-m

# Verify the session exists
if tmux has-session -t dacroq 2>/dev/null; then
    echo "Dacroq daemon started successfully in tmux session 'dacroq'"
    echo "To attach to the session, run: tmux attach -t dacroq"
    echo "To detach from the session, press: Ctrl+B then D"
    exit 0
else
    echo "Failed to start daemon - tmux session not found"
    exit 1
fi 