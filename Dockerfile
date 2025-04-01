FROM node:18-alpine AS web
WORKDIR /app

# Install Git and pnpm
RUN apk add --no-cache git && npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy the dacroq_web directory
COPY dacroq_web ./dacroq_web

# Navigate to dacroq_web directory
WORKDIR /app/dacroq_web

# Install dependencies and run updates
RUN pnpm install
RUN pnpm update

FROM golang:1.21-alpine AS api
WORKDIR /app

# Copy API source code
COPY api ./api

# Build the API
WORKDIR /app/api
RUN go build -o dacroq

FROM node:18-alpine
WORKDIR /app

# Install pnpm in the final stage (add Git here too if needed)
RUN npm install -g pnpm

# Copy web files and dependencies from web stage
COPY --from=web /app/dacroq_web ./dacroq_web
COPY --from=web /app/dacroq_web/node_modules ./dacroq_web/node_modules

# Copy API binary from api stage
COPY --from=api /app/api/dacroq ./api/dacroq

# Expose ports
EXPOSE 3000
EXPOSE 8080

# Run both services
CMD cd /app/dacroq_web && pnpm dev & cd /app/api && ./dacroq
