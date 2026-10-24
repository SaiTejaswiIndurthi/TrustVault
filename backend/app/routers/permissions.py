from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.dependencies import (
    get_client_ip,
    get_current_user,
    get_user_agent,
    require_document_owner,
)
from backend.app.models import (
    AuditEvent,
    Document,
    DocumentPermission,
    Notification,
    User,
)
from backend.app.schemas import (
    AuditEventResponse,
    PermissionGrantRequest,
    PermissionResponse,
    PermissionRevokeRequest,
)
from backend.app.security.audit_chain import record_audit_event

router = APIRouter(prefix="/api/permissions", tags=["Document Permissions"])

@router.get("/documents/{document_id}", response_model=list[PermissionResponse])
def get_document_permissions(
    document_id: str,
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """List permissions granted on a document. Restricted to document owner."""
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tenant_id == owner.tenant_id,
            Document.owner_id == owner.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you are not the owner."
        )

    perms = (
        db.query(DocumentPermission)
        .filter(DocumentPermission.document_id == doc.id)
        .order_by(DocumentPermission.granted_at.desc())
        .all()
    )

    result = []
    for p in perms:
        u = db.query(User).filter(User.id == p.user_id).first()
        g = db.query(User).filter(User.id == p.granted_by_id).first() if p.granted_by_id else None
        result.append(
            PermissionResponse(
                id=p.id,
                document_id=p.document_id,
                user_id=p.user_id,
                user_email=u.email if u else None,
                user_name=u.full_name if u else None,
                permission_level=p.permission_level,
                granted_by_id=p.granted_by_id,
                granted_by_name=g.full_name if g else None,
                granted_at=p.granted_at,
                is_active=p.is_active,
                revoked_at=p.revoked_at,
                revocation_reason=p.revocation_reason,
            )
        )
    return result


@router.post("/documents/{document_id}/grant", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def grant_permission(
    document_id: str,
    req: PermissionGrantRequest,
    request: Request,
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """
    Grants READ or EDIT access to an active user within the same tenant.
    Immediately effective.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Validate document ownership
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tenant_id == owner.tenant_id,
            Document.owner_id == owner.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or you are not the owner.")

    # Validate target user belongs to same tenant and is ACTIVE
    target_user = (
        db.query(User)
        .filter(
            User.id == req.user_id,
            User.tenant_id == owner.tenant_id,
            User.status == "ACTIVE",
        )
        .first()
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found, belongs to another organization, or is not ACTIVE."
        )

    if target_user.id == owner.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot grant permissions to yourself.")

    # Check for existing active permission
    existing = (
        db.query(DocumentPermission)
        .filter(
            DocumentPermission.document_id == doc.id,
            DocumentPermission.user_id == target_user.id,
            DocumentPermission.is_active == True,
        )
        .first()
    )

    now = datetime.now(timezone.utc)

    if existing:
        # Update existing permission level
        existing.permission_level = req.permission_level
        existing.granted_by_id = owner.id
        existing.granted_at = now
        perm = existing
    else:
        perm = DocumentPermission(
            document_id=doc.id,
            user_id=target_user.id,
            permission_level=req.permission_level,
            granted_by_id=owner.id,
            granted_at=now,
            is_active=True,
        )
        db.add(perm)

    db.commit()
    db.refresh(perm)

    # Tamper-evident audit log
    record_audit_event(
        db=db,
        tenant_id=owner.tenant_id,
        action="PERMISSION_GRANT",
        resource_type="DOCUMENT_PERMISSION",
        resource_id=perm.id,
        outcome="SUCCESS",
        actor_id=owner.id,
        actor_email=owner.email,
        details={
            "document_id": doc.id,
            "document_title": doc.title,
            "target_user_id": target_user.id,
            "target_user_email": target_user.email,
            "permission_level": req.permission_level,
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Dispatch notification to recipient
    notif = Notification(
        tenant_id=owner.tenant_id,
        user_id=target_user.id,
        title="Document Access Granted",
        message=f"{owner.full_name} granted you {req.permission_level} access to document '{doc.title}'.",
        type="PERMISSION_GRANTED",
    )
    db.add(notif)
    db.commit()

    return PermissionResponse(
        id=perm.id,
        document_id=perm.document_id,
        user_id=perm.user_id,
        user_email=target_user.email,
        user_name=target_user.full_name,
        permission_level=perm.permission_level,
        granted_by_id=owner.id,
        granted_by_name=owner.full_name,
        granted_at=perm.granted_at,
        is_active=perm.is_active,
    )


@router.post("/{permission_id}/revoke")
def revoke_permission(
    permission_id: str,
    req: PermissionRevokeRequest,
    request: Request,
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """
    Immediately revokes document access.
    Guarantees:
    - Sets is_active = False and revoked_at in database immediately.
    - Subsequent access requests by the user will be instantly rejected.
    - Records tamper-evident PERMISSION_REVOKE audit event.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    perm = (
        db.query(DocumentPermission)
        .join(Document, DocumentPermission.document_id == Document.id)
        .filter(
            DocumentPermission.id == permission_id,
            Document.tenant_id == owner.tenant_id,
            Document.owner_id == owner.id,
        )
        .first()
    )
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission record not found or you do not own the document."
        )

    if not perm.is_active:
        return {"status": "success", "message": "Permission was already revoked."}

    now = datetime.now(timezone.utc)
    perm.is_active = False
    perm.revoked_by_id = owner.id
    perm.revoked_at = now
    perm.revocation_reason = req.reason or "Revoked by owner"

    db.commit()

    target_user = db.query(User).filter(User.id == perm.user_id).first()
    doc = db.query(Document).filter(Document.id == perm.document_id).first()

    # Tamper-evident audit log
    record_audit_event(
        db=db,
        tenant_id=owner.tenant_id,
        action="PERMISSION_REVOKE",
        resource_type="DOCUMENT_PERMISSION",
        resource_id=perm.id,
        outcome="SUCCESS",
        actor_id=owner.id,
        actor_email=owner.email,
        details={
            "document_id": perm.document_id,
            "document_title": doc.title if doc else None,
            "revoked_user_id": perm.user_id,
            "revoked_user_email": target_user.email if target_user else None,
            "reason": perm.revocation_reason,
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )

    if target_user:
        notif = Notification(
            tenant_id=owner.tenant_id,
            user_id=target_user.id,
            title="Document Access Revoked",
            message=f"Your access to document '{doc.title if doc else 'Document'}' has been revoked.",
            type="PERMISSION_REVOKED",
        )
        db.add(notif)
        db.commit()

    return {
        "status": "success",
        "message": "Permission revoked immediately. Subsequent access will be blocked.",
        "permission_id": perm.id,
        "is_active": False,
        "revoked_at": perm.revoked_at.isoformat(),
    }


@router.get("/documents/{document_id}/activity", response_model=list[AuditEventResponse])
def get_document_activity(
    document_id: str,
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """Returns verifiable audit timeline for a specific owned document."""
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tenant_id == owner.tenant_id,
            Document.owner_id == owner.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you are not the owner."
        )

    events = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.tenant_id == owner.tenant_id,
            (AuditEvent.resource_id == doc.id) | (AuditEvent.details.ilike(f"%{doc.id}%"))
        )
        .order_by(AuditEvent.sequence_number.desc())
        .limit(50)
        .all()
    )
    return events


@router.get("/active-users", response_model=list[dict])
def list_shareable_users(
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """Lists other active users in the same organization for sharing dropdown."""
    users = (
        db.query(User)
        .filter(
            User.tenant_id == owner.tenant_id,
            User.id != owner.id,
            User.status == "ACTIVE",
        )
        .all()
    )
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
        }
        for u in users
    ]
