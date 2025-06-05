#!/bin/bash

# Dacroq Multi-Service Startup Script
# This script starts the reorganized services

echo "🚀 Starting Dacroq Services..."

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use!"
        return 1
    fi
    return 0
}

# Check required ports
echo "🔍 Checking ports..."
check_port 8001 || exit 1  # Hardware API
check_port 8002 || exit 1  # Data API  
check_port 3000 || exit 1  # Web Frontend

# Start Data API (Database operations)
echo "🗄️  Starting Data API on port 8002..."
cd data/api
python app.py --port 8002 --debug &
DATA_API_PID=$!
cd ../..

# Wait a moment for data API to start
sleep 2

# Start Hardware API (Hardware interfacing)
echo "🔧 Starting Hardware API on port 8001..."
cd api/hardware
python app.py --port 8001 --debug &
HARDWARE_API_PID=$!
cd ../..

# Wait for hardware API to start
sleep 2

# Start Web Frontend (if npm is available)
if command -v npm &> /dev/null; then
    echo "🌐 Starting Web Frontend on port 3000..."
    cd web
    npm run dev &
    WEB_PID=$!
    cd ..
else
    echo "⚠️  npm not found, skipping web frontend"
    WEB_PID=""
fi

echo ""
echo "✅ Services Started!"
echo "📊 Data API:     http://localhost:8002"
echo "🔧 Hardware API: http://localhost:8001" 
echo "🌐 Web Frontend: http://localhost:3000"
echo ""
echo "💡 Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    
    if [ ! -z "$DATA_API_PID" ]; then
        kill $DATA_API_PID 2>/dev/null
        echo "   ✓ Data API stopped"
    fi
    
    if [ ! -z "$HARDWARE_API_PID" ]; then
        kill $HARDWARE_API_PID 2>/dev/null
        echo "   ✓ Hardware API stopped"
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null
        echo "   ✓ Web Frontend stopped"
    fi
    
    echo "🏁 All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for user to stop
while true; do
    sleep 1
done 