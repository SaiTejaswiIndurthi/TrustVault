# Stage 1: Build Frontend Assets
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend
FROM python:3.13-slim

LABEL maintainer="trustvault@dev.local"
LABEL description="TrustVault Secure Document Platform — FastAPI Backend"

WORKDIR /app

# System packages for argon2 / cffi build
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/backend/
# Copy built frontend assets from frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist/ /app/frontend/dist/

# Create private vault storage directory
RUN mkdir -p /app/backend/storage/vault

# Seed database and start server on dynamic $PORT (required by Render/Heroku/Cloud platforms)
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "python backend/seed.py && uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
