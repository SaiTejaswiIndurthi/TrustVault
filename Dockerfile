# TrustVault — Backend Dockerfile
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
COPY frontend/dist/ /app/frontend/dist/

# Create private vault storage directory
RUN mkdir -p /app/backend/storage/vault

# Run migrations and start server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
