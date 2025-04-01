#!/bin/bash

# Build the Docker image
echo "Building Docker image..."
docker build -t dacroq .

# Check if ports are already in use
PORT_3000_STATUS=$(netstat -tuln | grep ":3000 " || echo "free")
PORT_8080_STATUS=$(netstat -tuln | grep ":8080 " || echo "free")

# Handle port conflicts
if [[ "$PORT_3000_STATUS" != "free" ]]; then
  echo "Warning: Port 3000 is already in use!"
  echo "You can either:"
  echo "1. Stop the process using port 3000"
  echo "2. Use a different port mapping (e.g. -p 3001:3000)"
  read -p "Would you like to try with port 3001 instead? (y/n): " USE_ALT_PORT_3000
else
  USE_ALT_PORT_3000="n"
fi

if [[ "$PORT_8080_STATUS" != "free" ]]; then
  echo "Warning: Port 8080 is already in use!"
  echo "You can either:"
  echo "1. Stop the process using port 8080"
  echo "2. Use a different port mapping (e.g. -p 8081:8080)"
  read -p "Would you like to try with port 8081 instead? (y/n): " USE_ALT_PORT_8080
else
  USE_ALT_PORT_8080="n"
fi

# Set port mappings based on responses
PORT_3000_MAPPING="3000:3000"
if [[ "$USE_ALT_PORT_3000" == "y" ]]; then
  PORT_3000_MAPPING="3001:3000"
fi

PORT_8080_MAPPING="8080:8080"
if [[ "$USE_ALT_PORT_8080" == "y" ]]; then
  PORT_8080_MAPPING="8081:8080"
fi

# Run the container with appropriate port mappings
echo "Running container with ports mapped..."
docker run -p $PORT_3000_MAPPING -p $PORT_8080_MAPPING dacroq