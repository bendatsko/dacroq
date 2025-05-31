#!/bin/bash
#
# stop-dacroq.sh
# Kills any running tmux sessions for the Dacroq front-end (“web-app”)
# and back-end (“api-app”).  Safe to run even if they aren’t running.

set -euo pipefail

# Array of session names we created in start-dacroq.sh
# SESSIONS=(web-app api-app)
SESSIONS=(api-app)

for S in "${SESSIONS[@]}"; do
    if tmux has-session -t "$S" 2>/dev/null; then
        echo "Stopping tmux session $S"
        tmux kill-session -t "$S"
    else
        echo "Session $S not running – skipping"
    fi
done

echo "✅ All Dacroq tmux sessions stopped."
