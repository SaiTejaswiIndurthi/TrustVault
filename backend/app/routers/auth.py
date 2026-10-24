import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.dependencies import (
    enforce_login_rate_limit,
    get_client_ip,
    get_current_user,
    get_user_agent,
    record_login_attempt,
)
from backend.app.models import (
    Notification,
    PasswordResetToken,
    Session as DbSession,
    Tenant,
    User,
)
from backend.app.schemas import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from backend.app.security.audit_chain import record_audit_event
from backend.app.security.captcha import verify_captcha_token
from backend.app.security.passwords import hash_password, verify_password
from backend.app.security.tokens import (
    create_access_jwt,
    generate_secure_token,
    hash_token,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    req: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # 1. Verify CAPTCHA Token
    is_captcha_valid, captcha_reason = await verify_captcha_token(req.captcha_token, remote_ip=client_ip)
    if not is_captcha_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CAPTCHA verification failed: {captcha_reason}"
        )

    # 2. Confirm password match
    if req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    # 3. Resolve or create organization / tenant
    tenant_slug = req.tenant_name.lower().replace(" ", "-").replace(".", "")[:32]
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if not tenant:
        tenant = Tenant(name=req.tenant_name, slug=tenant_slug)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

    # 4. Check if email already registered in this tenant
    existing_user = (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.email == req.email.lower().strip())
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists in this organization."
        )

    # 5. Hash password with Argon2id
    pwd_hash = hash_password(req.password)

    # 6. Create user with status PENDING_APPROVAL
    new_user = User(
        tenant_id=tenant.id,
        email=req.email.lower().strip(),
        full_name=req.full_name.strip(),
        phone_number=req.phone_number.strip(),
        password_hash=pwd_hash,
        role=req.role,
        status="PENDING_APPROVAL",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 7. Record append-only tamper-evident audit event
    record_audit_event(
        db=db,
        tenant_id=tenant.id,
        action="AUTH_REGISTER",
        resource_type="USER",
        resource_id=new_user.id,
        outcome="SUCCESS",
        actor_id=new_user.id,
        actor_email=new_user.email,
        details={
            "role": new_user.role,
            "status": new_user.status,
            "organization": tenant.name,
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # 8. Create system notification for admins
    notification = Notification(
        tenant_id=tenant.id,
        user_id=new_user.id,
        title="Registration Received",
        message="Your registration has been submitted and is awaiting administrator approval.",
        type="ACCOUNT_REGISTRATION",
    )
    db.add(notification)
    db.commit()

    return {
        "status": "success",
        "message": "Account registered successfully. Your account is currently PENDING_APPROVAL by an administrator.",
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "account_status": new_user.status,
    }


@router.post("/login")
async def login(
    req: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_login_rate_limit(request)
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    email_clean = req.email.lower().strip()

    # Query user across tenants by email
    user = db.query(User).filter(User.email == email_clean).first()

    # Generic authentication failure message to prevent user enumeration
    generic_error = "Invalid email or password."

    if not user:
        record_login_attempt(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=generic_error,
        )

    # Verify password with Argon2id
    if not verify_password(req.password, user.password_hash):
        record_login_attempt(request)
        record_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            action="AUTH_LOGIN",
            resource_type="SESSION",
            outcome="DENIED",
            actor_id=user.id,
            actor_email=user.email,
            details={"reason": "Password mismatch"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=generic_error,
        )

    # Check Account Status
    if user.status == "PENDING_APPROVAL":
        record_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            action="AUTH_LOGIN",
            resource_type="SESSION",
            outcome="DENIED",
            actor_id=user.id,
            actor_email=user.email,
            details={"status": user.status, "reason": "Account pending approval"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval. You will receive access once approved by an administrator."
        )

    if user.status == "SUSPENDED":
        record_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            action="AUTH_LOGIN",
            resource_type="SESSION",
            outcome="DENIED",
            actor_id=user.id,
            actor_email=user.email,
            details={"status": user.status, "reason": "Account suspended"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is suspended. Reason: {user.suspension_reason or 'Contact security administrator.'}"
        )

    if user.status == "REJECTED":
        record_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            action="AUTH_LOGIN",
            resource_type="SESSION",
            outcome="DENIED",
            actor_id=user.id,
            actor_email=user.email,
            details={"status": user.status, "reason": "Account rejected"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration request was rejected by an administrator."
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active."
        )

    # Create server-side session
    session_id = str(uuid.uuid4())
    token_seed = generate_secure_token(32)
    session_token = f"{session_id}.{token_seed}"
    token_hash_val = hash_token(session_token)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.SESSION_EXPIRE_MINUTES)

    db_session = DbSession(
        id=session_id,
        user_id=user.id,
        token_hash=token_hash_val,
        ip_address=client_ip,
        user_agent=user_agent,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(db_session)
    db.commit()

    # Create signed JWT wrapping session
    jwt_token = create_access_jwt({
        "sub": user.id,
        "sid": session_id,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "email": user.email,
    })

    # Record successful login audit event
    record_audit_event(
        db=db,
        tenant_id=user.tenant_id,
        action="AUTH_LOGIN",
        resource_type="SESSION",
        resource_id=session_id,
        outcome="SUCCESS",
        actor_id=user.id,
        actor_email=user.email,
        details={"role": user.role},
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="trustvault_session",
        value=jwt_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.SESSION_EXPIRE_MINUTES * 60,
    )

    return {
        "status": "success",
        "access_token": jwt_token,
        "token_type": "Bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "status": user.status,
            "tenant_id": user.tenant_id,
        }
    }


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Revoke all active sessions for this user or specific session
    db.query(DbSession).filter(
        DbSession.user_id == current_user.id,
        DbSession.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()

    record_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        action="AUTH_LOGOUT",
        resource_type="SESSION",
        outcome="SUCCESS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Clear HttpOnly cookie
    response.delete_cookie(key="trustvault_session")
    return {"status": "success", "message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Validate CAPTCHA
    is_valid, reason = await verify_captcha_token(req.captcha_token, remote_ip=client_ip)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"CAPTCHA failed: {reason}")

    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    
    # Always return success message to prevent user enumeration
    generic_msg = "If that email address exists in our system, password reset instructions have been dispatched."
    
    if not user:
        return {"status": "success", "message": generic_msg}

    # Generate cryptographically secure reset token
    raw_token = generate_secure_token(32)
    token_hash_val = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash_val,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(reset_record)
    db.commit()

    record_audit_event(
        db=db,
        tenant_id=user.tenant_id,
        action="AUTH_PASSWORD_RESET_REQUESTED",
        resource_type="USER",
        resource_id=user.id,
        outcome="SUCCESS",
        actor_id=user.id,
        actor_email=user.email,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # In development mode, return token to ease testing and verification
    return {
        "status": "success",
        "message": generic_msg,
        "dev_reset_token": raw_token if settings.ENVIRONMENT == "development" else None,
    }


@router.post("/reset-password")
async def reset_password(
    req: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    # Hash incoming token to look up
    token_hash_val = hash_token(req.token)
    now = datetime.now(timezone.utc)

    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash_val)
        .first()
    )

    if not reset_token or reset_token.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid or has already been used."
        )

    reset_expires = reset_token.expires_at
    if reset_expires.tzinfo is None:
        reset_expires = reset_expires.replace(tzinfo=timezone.utc)

    if reset_expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has expired."
        )

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")

    # Update password
    user.password_hash = hash_password(req.new_password)
    reset_token.is_used = True

    # Security requirement: Invalidate ALL active sessions upon password reset!
    db.query(DbSession).filter(
        DbSession.user_id == user.id,
        DbSession.is_revoked == False
    ).update({"is_revoked": True})

    db.commit()

    record_audit_event(
        db=db,
        tenant_id=user.tenant_id,
        action="AUTH_PASSWORD_RESET_COMPLETED",
        resource_type="USER",
        resource_id=user.id,
        outcome="SUCCESS",
        actor_id=user.id,
        actor_email=user.email,
        details={"session_invalidation": "ALL_REVOKED"},
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {"status": "success", "message": "Password reset successfully. You may now log in with your new credentials."}
