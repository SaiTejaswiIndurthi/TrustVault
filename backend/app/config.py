import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "TrustVault"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    
    # Security & Sessions
    SECRET_KEY: str = "trustvault-enterprise-secure-production-key-change-in-prod-983471089234"
    ALGORITHM: str = "HS256"
    SESSION_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CSRF_SECRET: str = "trustvault-csrf-protection-secret-key-3984712093"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/trustvault.db")
    
    # Document Storage
    STORAGE_DIR: str = str(BASE_DIR / "storage" / "vault")
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".txt"]
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png",
        "image/jpeg",
        "text/plain",
    ]
    
    # CAPTCHA
    CAPTCHA_PROVIDER: str = os.getenv("CAPTCHA_PROVIDER", "dev")  # dev, turnstile, recaptcha
    CAPTCHA_SECRET_KEY: str = os.getenv("CAPTCHA_SECRET_KEY", "dev_secret_key")
    DEV_CAPTCHA_PASSKEY: str = "TRUSTVAULT_DEV_CAPTCHA_PASSED"
    
    # Rate Limiting
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_WINDOW_SECONDS: int = 300  # 5 minutes
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure storage path exists
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
