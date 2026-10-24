import time
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import Session as DbSession, User
from backend.app.security.tokens import decode_access_jwt, hash_token

# In-memory sliding window for authentication rate limiting
# IP -> list of attempt timestamps
_login_rate_limits = defaultdict(list)

def reset_rate_limits():
    """Reset rate limit state (useful in testing)."""
    _login_rate_limits.clear()

def enforce_login_rate_limit(request: Request):
    """
    Enforces maximum login attempts within the configured window.
    Protects against credential stuffing and brute-force attacks.
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - settings.RATE_LIMIT_WINDOW_SECONDS
    
    # Filter attempts within window
    _login_rate_limits[client_ip] = [
        t for t in _login_rate_limits[client_ip] if t > window_start
    ]
    
    if len(_login_rate_limits[client_ip]) >= settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again after 5 minutes."
        )

def record_login_attempt(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _login_rate_limits[client_ip].append(time.time())

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def get_user_agent(request: Request) -> str:
    return request.headers.get("User-Agent", "Unknown")[:512]

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    trustvault_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> User:
    """
    Validates session token from HttpOnly cookie or Authorization Bearer header.
    Verifies database session state, expiry, and revocation.
    Verifies user status is strictly ACTIVE.
    """
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]
    elif trustvault_session:
        raw_token = trustvault_session

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. No session token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # First decode JWT payload
    payload = decode_access_jwt(raw_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session credentials.",
        )

    # Verify session in database
    hashed = hash_token(raw_token)
    db_session = (
        db.query(DbSession)
        .filter(DbSession.id == session_id, DbSession.user_id == user_id)
        .first()
    )

    if not db_session or db_session.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or invalidated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    # Ensure timezone awareness comparison
    sess_expires = db_session.expires_at
    if sess_expires.tzinfo is None:
        sess_expires = sess_expires.replace(tzinfo=timezone.utc)

    if sess_expires < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    # Check Account Status
    if user.status == "PENDING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval. Please wait for an administrator to review your registration."
        )
    if user.status == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account has been suspended by an administrator. Reason: {user.suspension_reason or 'Policy violation.'}"
        )
    if user.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account registration was rejected. Reason: {user.rejection_reason or 'Administrative decision.'}"
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active."
        )

    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Enforces Administrator role."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Administrator privileges required."
        )
    return current_user

def require_document_owner(current_user: User = Depends(get_current_user)) -> User:
    """Enforces Document Owner role."""
    if current_user.role != "DOCUMENT_OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Document Owner privileges required."
        )
    return current_user

def require_viewer(current_user: User = Depends(get_current_user)) -> User:
    """Enforces Viewer role."""
    if current_user.role != "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Viewer privileges required."
        )
    return current_user
