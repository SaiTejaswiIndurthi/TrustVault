import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    slug = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="tenant", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(32), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Roles: ADMIN, DOCUMENT_OWNER, VIEWER
    role = Column(String(32), nullable=False, default="VIEWER", index=True)
    
    # Statuses: PENDING_APPROVAL, ACTIVE, REJECTED, SUSPENDED
    status = Column(String(32), nullable=False, default="PENDING_APPROVAL", index=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    
    approved_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    rejected_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspension_reason = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_tenant_user_email"),
    )

    tenant = relationship("Tenant", back_populates="users")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="owner", foreign_keys="Document.owner_id")
    permissions = relationship("DocumentPermission", back_populates="user", foreign_keys="DocumentPermission.user_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    is_revoked = Column(Boolean, default=False, nullable=False, index=True)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=False, default="General", index=True)
    
    # Internal random storage key - never exposed publicly
    storage_key = Column(String(64), nullable=False, unique=True, index=True)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(128), nullable=False)
    file_hash_sha256 = Column(String(64), nullable=False)
    
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    tenant = relationship("Tenant", back_populates="documents")
    owner = relationship("User", back_populates="documents", foreign_keys=[owner_id])
    permissions = relationship("DocumentPermission", back_populates="document", cascade="all, delete-orphan")


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Permission levels: READ, EDIT
    permission_level = Column(String(16), nullable=False, default="READ")
    
    granted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    revoked_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_doc_user_active", "document_id", "user_id", "is_active"),
    )

    document = relationship("Document", back_populates="permissions")
    user = relationship("User", back_populates="permissions", foreign_keys=[user_id])
    granted_by = relationship("User", foreign_keys=[granted_by_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    
    actor_id = Column(String(36), nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    
    # Action names: e.g. AUTH_LOGIN, AUTH_LOGOUT, DOC_UPLOAD, DOC_DOWNLOAD, PERMISSION_GRANT, PERMISSION_REVOKE, ACCESS_DENIED, etc.
    action = Column(String(64), nullable=False, index=True)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=True)
    
    # Outcome: SUCCESS, DENIED, FAILURE
    outcome = Column(String(16), nullable=False, default="SUCCESS", index=True)
    
    details = Column(Text, nullable=False, default="{}")
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    request_id = Column(String(64), nullable=True)
    
    # Tamper-evident hash chain
    prev_hash = Column(String(64), nullable=False)
    event_hash = Column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "sequence_number", name="uq_tenant_sequence"),
        Index("idx_audit_tenant_seq", "tenant_id", "sequence_number"),
    )

    tenant = relationship("Tenant", back_populates="audit_events")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(64), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="notifications")
