#!/bin/bash
tmux new-session -d -s api-app 'cd ~/daemon && sudo python3 app.py'
