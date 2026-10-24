from datetime import datetime
from typing import Any
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    slug: str = Field(..., min_length=2, max_length=64)

class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- User & Auth Schemas ---

class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    email: EmailStr
    phone_number: str = Field(..., min_length=7, max_length=32)
    password: str = Field(..., min_length=10, max_length=128)
    confirm_password: str = Field(..., min_length=10, max_length=128)
    role: str = Field(..., description="Target role: DOCUMENT_OWNER or VIEWER")
    tenant_name: str = Field(default="TrustVault Default Org", min_length=2, max_length=128)
    captcha_token: str = Field(..., description="CAPTCHA verification token")

    @field_validator("role")
    def validate_role(cls, v):
        allowed = ["DOCUMENT_OWNER", "VIEWER"]
        if v.upper() not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}. Administrator accounts cannot be self-registered.")
        return v.upper()

    @field_validator("phone_number")
    def validate_phone(cls, v):
        # Must contain country code e.g. +1..., +44..., +91...
        clean = v.strip()
        if not re.match(r"^\+?[0-9\s\-()]{7,32}$", clean):
            raise ValueError("Phone number must be a valid format including international country code.")
        return clean

    @field_validator("password")
    def validate_password_strength(cls, v):
        if len(v) < 10:
            raise ValueError("Password must be at least 10 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one numeric digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    captcha_token: str | None = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    captcha_token: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=10)
    confirm_password: str = Field(..., min_length=10)

class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="ACTIVE, REJECTED, or SUSPENDED")
    reason: str | None = None

    @field_validator("status")
    def validate_status(cls, v):
        allowed = ["ACTIVE", "REJECTED", "SUSPENDED"]
        if v.upper() not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v.upper()

class UserResponse(BaseModel):
    id: str
    tenant_id: str
    email: str
    full_name: str
    phone_number: str
    role: str
    status: str
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    rejection_reason: str | None = None
    suspension_reason: str | None = None

    class Config:
        from_attributes = True

# --- Document Schemas ---

class DocumentResponse(BaseModel):
    id: str
    tenant_id: str
    owner_id: str
    title: str
    description: str | None
    category: str
    original_filename: str
    file_size: int
    mime_type: str
    file_hash_sha256: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    owner_name: str | None = None
    owner_email: str | None = None
    user_permission: str | None = None  # Populated for Viewers: "READ" or "EDIT"

    class Config:
        from_attributes = True

class DocumentUpdateMetadataRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None

# --- Permission Schemas ---

class PermissionGrantRequest(BaseModel):
    user_id: str
    permission_level: str = Field(default="READ", description="READ or EDIT")

    @field_validator("permission_level")
    def validate_perm(cls, v):
        allowed = ["READ", "EDIT"]
        if v.upper() not in allowed:
            raise ValueError("Permission level must be READ or EDIT")
        return v.upper()

class PermissionRevokeRequest(BaseModel):
    reason: str | None = None

class PermissionResponse(BaseModel):
    id: str
    document_id: str
    user_id: str
    user_email: str | None = None
    user_name: str | None = None
    permission_level: str
    granted_by_id: str | None = None
    granted_by_name: str | None = None
    granted_at: datetime
    is_active: bool
    revoked_at: datetime | None = None
    revocation_reason: str | None = None

    class Config:
        from_attributes = True

# --- Audit & Analytics Schemas ---

class AuditEventResponse(BaseModel):
    id: str
    sequence_number: int
    timestamp: datetime
    actor_id: str | None
    actor_email: str | None
    action: str
    resource_type: str
    resource_id: str | None
    outcome: str
    details: str
    ip_address: str | None
    prev_hash: str
    event_hash: str

    class Config:
        from_attributes = True

class AuditVerificationResponse(BaseModel):
    is_valid: bool
    total_events: int
    verified_events: int
    latest_hash: str | None
    tampered_events: list[dict[str, Any]]
    message: str

class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    pending_approvals: int
    suspended_users: int
    total_documents: int
    total_audit_events: int
    active_sessions_count: int
    audit_chain_valid: bool
    recent_events: list[AuditEventResponse]
    category_distribution: dict[str, int]
    activity_timeline: list[dict[str, Any]]
    denied_access_attempts: int = 0
    security_alerts: list[dict[str, Any]] = []

class OwnerDashboardStats(BaseModel):
    total_owned_documents: int
    shared_documents_count: int
    active_permission_grants: int
    recent_events: list[AuditEventResponse]
    categories: list[str]

class ViewerDashboardStats(BaseModel):
    total_accessible_documents: int
    categories: list[str]
