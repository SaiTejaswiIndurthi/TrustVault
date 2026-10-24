from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.dependencies import (
    get_client_ip,
    get_user_agent,
    require_admin,
)
from backend.app.models import (
    AuditEvent,
    Document,
    DocumentPermission,
    Notification,
    Session as DbSession,
    User,
)
from backend.app.schemas import (
    AdminDashboardStats,
    AuditEventResponse,
    AuditVerificationResponse,
    DocumentResponse,
    PermissionResponse,
    UserResponse,
    UserStatusUpdateRequest,
)
from backend.app.security.audit_chain import (
    record_audit_event,
    verify_tenant_audit_chain,
)

router = APIRouter(prefix="/api/admin", tags=["Administrator Operations"])

@router.get("/stats", response_model=AdminDashboardStats)
def get_admin_dashboard_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Computes real database-backed metrics for the administrator dashboard.
    Never fabricates figures.
    """
    tenant_id = admin.tenant_id

    total_users = db.query(User).filter(User.tenant_id == tenant_id).count()
    active_users = db.query(User).filter(User.tenant_id == tenant_id, User.status == "ACTIVE").count()
    pending_approvals = db.query(User).filter(User.tenant_id == tenant_id, User.status == "PENDING_APPROVAL").count()
    suspended_users = db.query(User).filter(User.tenant_id == tenant_id, User.status == "SUSPENDED").count()

    total_documents = db.query(Document).filter(Document.tenant_id == tenant_id).count()

    total_audit_events = db.query(AuditEvent).filter(AuditEvent.tenant_id == tenant_id).count()

    # Active non-revoked, unexpired sessions
    now = datetime.now(timezone.utc)
    active_sessions_count = (
        db.query(DbSession)
        .join(User, DbSession.user_id == User.id)
        .filter(User.tenant_id == tenant_id, DbSession.is_revoked == False, DbSession.expires_at > now)
        .count()
    )

    # Check audit chain validity
    verification = verify_tenant_audit_chain(db, tenant_id)

    # Recent audit events
    recent_events = (
        db.query(AuditEvent)
        .filter(AuditEvent.tenant_id == tenant_id)
        .order_by(AuditEvent.sequence_number.desc())
        .limit(10)
        .all()
    )

    # Category distribution
    categories = (
        db.query(Document.category)
        .filter(Document.tenant_id == tenant_id)
        .all()
    )
    cat_dist = {}
    for (cat,) in categories:
        cat_dist[cat] = cat_dist.get(cat, 0) + 1

    # Activity timeline summary
    activity_timeline = []
    actions = (
        db.query(AuditEvent.action)
        .filter(AuditEvent.tenant_id == tenant_id)
        .limit(100)
        .all()
    )
    act_counts = {}
    for (act,) in actions:
        act_counts[act] = act_counts.get(act, 0) + 1
    for act, cnt in act_counts.items():
        activity_timeline.append({"action": act, "count": cnt})

    # Denied access attempts
    denied_access_attempts = (
        db.query(AuditEvent)
        .filter(AuditEvent.tenant_id == tenant_id, AuditEvent.outcome == "DENIED")
        .count()
    )

    # Database-backed security alerts
    security_alerts = []
    if not verification["is_valid"]:
        security_alerts.append({
            "severity": "CRITICAL",
            "title": "Audit Chain Integrity Violation",
            "description": verification["message"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    if pending_approvals > 0:
        security_alerts.append({
            "severity": "MEDIUM",
            "title": f"{pending_approvals} Registration(s) Pending Approval",
            "description": "New users cannot log in until approved by an administrator.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    if suspended_users > 0:
        security_alerts.append({
            "severity": "LOW",
            "title": f"{suspended_users} Account(s) Currently Suspended",
            "description": "Sessions for suspended accounts are invalidated automatically.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    if denied_access_attempts > 0:
        security_alerts.append({
            "severity": "HIGH",
            "title": f"{denied_access_attempts} Denied Access Attempt(s) Recorded",
            "description": "Unauthorized access or download attempts have been intercepted and logged.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "total_users": total_users,
        "active_users": active_users,
        "pending_approvals": pending_approvals,
        "suspended_users": suspended_users,
        "total_documents": total_documents,
        "total_audit_events": total_audit_events,
        "active_sessions_count": active_sessions_count,
        "audit_chain_valid": verification["is_valid"],
        "recent_events": recent_events,
        "category_distribution": cat_dist,
        "activity_timeline": activity_timeline,
        "denied_access_attempts": denied_access_attempts,
        "security_alerts": security_alerts,
    }


@router.get("/users", response_model=list[UserResponse])
def list_users(
    search: str | None = None,
    status_filter: str | None = None,
    role_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.tenant_id == admin.tenant_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(s)) | (User.email.ilike(s)))
    if status_filter:
        query = query.filter(User.status == status_filter.upper())
    if role_filter:
        query = query.filter(User.role == role_filter.upper())

    return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    req: UserStatusUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == admin.tenant_id)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot modify their own status."
        )

    now = datetime.now(timezone.utc)
    old_status = target_user.status
    target_user.status = req.status
    target_user.updated_at = now

    action_label = f"USER_{req.status}"

    if req.status == "ACTIVE":
        target_user.approved_by_id = admin.id
        target_user.approved_at = now
        notification_title = "Account Approved"
        notification_msg = "Your TrustVault account has been approved by an administrator. You may now log in."
    elif req.status == "REJECTED":
        target_user.rejected_by_id = admin.id
        target_user.rejected_at = now
        target_user.rejection_reason = req.reason
        notification_title = "Account Rejected"
        notification_msg = f"Your registration was rejected: {req.reason or 'Administrative review.'}"
    elif req.status == "SUSPENDED":
        target_user.suspended_at = now
        target_user.suspension_reason = req.reason
        notification_title = "Account Suspended"
        notification_msg = f"Your account has been suspended: {req.reason or 'Security policy violation.'}"

    # If SUSPENDED or REJECTED, immediately revoke all active sessions for this user
    if req.status in ["SUSPENDED", "REJECTED"]:
        db.query(DbSession).filter(
            DbSession.user_id == target_user.id,
            DbSession.is_revoked == False
        ).update({"is_revoked": True})

    # Create target notification
    notification = Notification(
        tenant_id=admin.tenant_id,
        user_id=target_user.id,
        title=notification_title,
        message=notification_msg,
        type=action_label,
    )
    db.add(notification)

    # Record tamper-evident audit log
    record_audit_event(
        db=db,
        tenant_id=admin.tenant_id,
        action=action_label,
        resource_type="USER",
        resource_id=target_user.id,
        outcome="SUCCESS",
        actor_id=admin.id,
        actor_email=admin.email,
        details={
            "target_user_email": target_user.email,
            "old_status": old_status,
            "new_status": req.status,
            "reason": req.reason,
        },
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    db.commit()
    db.refresh(target_user)

    return {
        "status": "success",
        "message": f"User status updated to {req.status}",
        "user_id": target_user.id,
        "new_status": target_user.status,
    }


@router.get("/documents", response_model=list[DocumentResponse])
def list_document_metadata(
    search: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Administrative monitoring of document metadata.
    IMPORTANT: Administrators can inspect metadata (size, owner, category, timestamps)
    to enforce governance, but are STRICTLY PREVENTED from downloading confidential content.
    """
    query = (
        db.query(Document, User.full_name, User.email)
        .join(User, Document.owner_id == User.id)
        .filter(Document.tenant_id == admin.tenant_id)
    )

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(Document.title.ilike(s))
    if category:
        query = query.filter(Document.category == category)

    results = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()

    docs = []
    for doc, owner_name, owner_email in results:
        doc_dict = {
            "id": doc.id,
            "tenant_id": doc.tenant_id,
            "owner_id": doc.owner_id,
            "title": doc.title,
            "description": doc.description,
            "category": doc.category,
            "original_filename": doc.original_filename,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "file_hash_sha256": doc.file_hash_sha256,
            "is_archived": doc.is_archived,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "owner_name": owner_name,
            "owner_email": owner_email,
        }
        docs.append(DocumentResponse(**doc_dict))

    return docs


@router.get("/permissions", response_model=list[PermissionResponse])
def list_all_permissions(
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Governance review of all active and revoked permission grants across tenant."""
    perms = (
        db.query(DocumentPermission)
        .join(Document, DocumentPermission.document_id == Document.id)
        .filter(Document.tenant_id == admin.tenant_id)
        .order_by(DocumentPermission.granted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    response = []
    for p in perms:
        response.append(
            PermissionResponse(
                id=p.id,
                document_id=p.document_id,
                user_id=p.user_id,
                user_email=p.user.email if p.user else None,
                user_name=p.user.full_name if p.user else None,
                permission_level=p.permission_level,
                granted_by_id=p.granted_by_id,
                granted_by_name=p.granted_by.full_name if p.granted_by else None,
                granted_at=p.granted_at,
                is_active=p.is_active,
                revoked_at=p.revoked_at,
                revocation_reason=p.revocation_reason,
            )
        )
    return response


@router.get("/audit-logs", response_model=list[AuditEventResponse])
def get_audit_logs(
    action: str | None = None,
    outcome: str | None = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEvent).filter(AuditEvent.tenant_id == admin.tenant_id)
    if action:
        query = query.filter(AuditEvent.action == action)
    if outcome:
        query = query.filter(AuditEvent.outcome == outcome)

    return query.order_by(AuditEvent.sequence_number.desc()).offset(skip).limit(limit).all()


@router.post("/audit-logs/verify", response_model=AuditVerificationResponse)
def verify_audit_logs(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Executes the cryptographic hash chain verification engine.
    Scans every audit record, recalculates SHA-256 hashes, and checks sequence links.
    """
    result = verify_tenant_audit_chain(db, admin.tenant_id)
    return AuditVerificationResponse(**result)
