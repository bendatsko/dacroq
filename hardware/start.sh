#!/bin/bash
# Start script for Dacroq Hardware API

cd "$(dirname "$0")"

echo "🚀 Starting Dacroq Hardware API..."

# Check if running in development mode
if [[ "$1" == "--dev" ]]; then
    echo "🔧 Development mode enabled"
    python3 app.py --dev --port 8000
else
    echo "🏭 Production mode"
    python3 app.py --port 8000
fi 