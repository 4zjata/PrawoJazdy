# Stage 1: Build Frontend + Server Bundle
FROM node:20-slim AS builder
WORKDIR /app/frontend
# Copy only package files first for caching
COPY prawo-jazdy-app/package*.json ./
RUN npm install
# Copy the rest and build
COPY prawo-jazdy-app/ .
RUN npm run build

# Stage 2: Final Image
FROM python:3.11-slim

# Install system dependencies (Node.js and FFmpeg)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Prepare Backend
COPY baza_pytan.xlsx ./
COPY prawo_jazdy_backend/requirements.txt ./prawo_jazdy_backend/
RUN pip install --no-cache-dir -r ./prawo_jazdy_backend/requirements.txt
COPY prawo_jazdy_backend/ ./prawo_jazdy_backend/

# 2. Prepare Frontend Production Runtime
WORKDIR /app/prawo-jazdy-app
COPY --from=builder /app/frontend/package*.json ./
# We need production node_modules because the server bundle has 'external' deps
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/frontend/dist ./dist

# 3. Startup Configuration
WORKDIR /app
COPY start.sh ./
RUN chmod +x start.sh

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Express port
EXPOSE 5000
# FastAPI port (accessible within container or via proxy)
EXPOSE 8000

CMD ["./start.sh"]
