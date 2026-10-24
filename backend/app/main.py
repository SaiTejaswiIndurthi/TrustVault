from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
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

# Include Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(permissions.router)
app.include_router(audit.router)

@app.get("/")
def root():
    return {
        "app": "TrustVault API",
        "tagline": "Secure Sharing, Smarter Access, Verifiable Accountability",
        "version": settings.VERSION,
        "docs": "/api/docs",
        "health": "/api/health",
    }
