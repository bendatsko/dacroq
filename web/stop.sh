#!/bin/bash

set -euo pipefail
SESSIONS=(ui)

for S in "${SESSIONS[@]}"; do
    if tmux has-session -t "$S" 2>/dev/null; then
        echo "Stopping tmux session $S"
        tmux kill-session -t "$S"
    else
        echo "Session $S not running – skipping"
    fi
done

echo "All Dacroq tmux sessions stopped."