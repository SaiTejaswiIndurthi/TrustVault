from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.dependencies import get_current_user
from backend.app.models import Notification, User

router = APIRouter(prefix="/api", tags=["General & Notifications"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TrustVault API",
        "version": "1.0.0",
        "security": {
            "argon2id": "active",
            "audit_hash_chain": "active",
            "tamper_evident": True,
            "private_vault_storage": "isolated",
        }
    }

@router.get("/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifs
    ]

@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.user_id == current_user.id)
        .first()
    )
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}
