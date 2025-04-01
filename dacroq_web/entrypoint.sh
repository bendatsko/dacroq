#!/bin/sh

# Start the website service with [website] prefix for each output line
cd /app/dacroq_web
pnpm dev | sed 's/^/[website] /' &

# Build and run the API service with [api] prefix for each output line
cd /app/api
# Build the API binary (using main.go)
go build -o dacroq main.go && \
./dacroq | sed 's/^/[api] /'

# Wait for background processes to keep the container running
wait
