import os
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from backend.app.config import settings
from backend.app.database import Base, engine
from backend.app.routers import admin, audit, auth, documents, permissions

# Create tables on startup if not present
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="TrustVault — Enterprise Secure Document Sharing & Tamper-Evident Accountability Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Custom Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(permissions.router)
app.include_router(audit.router)

# Serve Frontend SPA if built
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Do not catch /api routes
        if full_path.startswith("api"):
            return Response(status_code=404)
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "app": "TrustVault API",
            "tagline": "Secure Sharing, Smarter Access, Verifiable Accountability",
            "version": settings.VERSION,
            "docs": "/api/docs",
            "health": "/api/health",
        }
