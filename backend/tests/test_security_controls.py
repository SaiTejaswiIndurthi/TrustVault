import io
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.models import AuditEvent, PasswordResetToken, User
from backend.app.security.audit_chain import record_audit_event
from backend.app.security.tokens import generate_secure_token, hash_token

def test_login_rate_limiting_enforcement(client: TestClient, owner_user):
    """
    After 5 consecutive failed login attempts, subsequent attempts must be rejected with 429 Too Many Requests.
    """
    for _ in range(5):
        res = client.post(
            "/api/auth/login",
            json={"email": owner_user.email, "password": "WrongPassword99!"},
        )
        assert res.status_code == 401

    # 6th attempt should hit rate limit
    limited_res = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "SuperSecretOwnerPass123!"},
    )
    assert limited_res.status_code == 429
    assert "Too many authentication attempts" in limited_res.json()["detail"]


def test_zero_metadata_leakage_for_viewers(
    client: TestClient, owner_user, viewer_user, sample_pdf_document
):
    """
    Viewers listing documents must never receive metadata or listings of unshared documents.
    """
    viewer_login = client.post(
        "/api/auth/login",
        json={"email": viewer_user.email, "password": "SuperSecretViewerPass123!"},
    )
    viewer_headers = {"Authorization": f"Bearer {viewer_login.json()['access_token']}"}

    docs_res = client.get("/api/documents", headers=viewer_headers)
    assert docs_res.status_code == 200
    docs = docs_res.json()
    assert len(docs) == 0  # Zero unshared documents exposed!


def test_login_rejected_user_blocked(client: TestClient, seeded_tenant, db_session):
    """User in REJECTED status must be blocked from logging in."""
    from backend.app.security.passwords import hash_password
    rejected_user = User(
        tenant_id=seeded_tenant.id,
        email="rejected_user@trustvault.com",
        full_name="Rejected Applicant",
        phone_number="+1-555-010-9999",
        password_hash=hash_password("RejectedPass123!"),
        role="VIEWER",
        status="REJECTED",
        rejection_reason="Failed background check.",
    )
    db_session.add(rejected_user)
    db_session.commit()

    res = client.post(
        "/api/auth/login",
        json={"email": rejected_user.email, "password": "RejectedPass123!"},
    )
    assert res.status_code == 403
    assert "rejected" in res.json()["detail"]


def test_expired_password_reset_token_rejected(client: TestClient, owner_user, db_session):
    """Expired password reset tokens must be rejected."""
    raw_token = generate_secure_token(32)
    token_hash_val = hash_token(raw_token)
    expired_time = datetime.now(timezone.utc) - timedelta(hours=2)

    reset_record = PasswordResetToken(
        user_id=owner_user.id,
        token_hash=token_hash_val,
        expires_at=expired_time,
        is_used=False,
    )
    db_session.add(reset_record)
    db_session.commit()

    res = client.post(
        "/api/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "NewValidPassword123!",
            "confirm_password": "NewValidPassword123!",
        },
    )
    assert res.status_code == 400
    assert "expired" in res.json()["detail"]


def test_audit_deletion_gap_detected(client: TestClient, admin_user, db_session):
    """
    If an attacker deletes an intermediate audit event, the verification engine
    detects the sequence gap and broken chain.
    """
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_user.email, "password": "SuperSecretAdminPass123!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Record 3 events
    record_audit_event(db_session, admin_user.tenant_id, "TEST_ACTION_1", "RESOURCE", actor_id=admin_user.id)
    ev2 = record_audit_event(db_session, admin_user.tenant_id, "TEST_ACTION_2", "RESOURCE", actor_id=admin_user.id)
    record_audit_event(db_session, admin_user.tenant_id, "TEST_ACTION_3", "RESOURCE", actor_id=admin_user.id)

    # Delete event 2 directly in DB
    db_session.delete(ev2)
    db_session.commit()

    # Verification must flag sequence gap / broken chain
    verify_res = client.post("/api/admin/audit-logs/verify", headers=admin_headers)
    assert verify_res.status_code == 200
    report = verify_res.json()
    assert report["is_valid"] is False
    assert len(report["tampered_events"]) > 0
