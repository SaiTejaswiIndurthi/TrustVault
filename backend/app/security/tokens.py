import hashlib
import secrets
from datetime import datetime, timedelta, timezone
import jwt
from backend.app.config import settings

def generate_secure_token(nbytes: int = 32) -> str:
    """Generate cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(nbytes)

def hash_token(token: str) -> str:
    """SHA-256 hash of token to prevent plaintext token storage in DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_access_jwt(data: dict, expires_minutes: int = None) -> str:
    """Create signed JWT for user session authentication."""
    to_encode = data.copy()
    expire_minutes = expires_minutes or settings.SESSION_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_jwt(token: str) -> dict | None:
    """Decode and validate signature and expiry of access JWT."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def generate_csrf_token() -> str:
    return secrets.token_hex(24)

def verify_csrf_token(submitted_token: str, expected_token: str) -> bool:
    if not submitted_token or not expected_token:
        return False
    return secrets.compare_digest(submitted_token, expected_token)
