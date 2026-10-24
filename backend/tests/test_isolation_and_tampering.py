import io
import pytest
from fastapi.testclient import TestClient
from backend.app.models import AuditEvent

def test_cross_tenant_isolation(
    client: TestClient, sample_pdf_document, other_tenant_user
):
    """
    User from Tenant B must never access, discover, or download Tenant A documents.
    """
    outsider_login = client.post(
        "/api/auth/login",
        json={"email": other_tenant_user.email, "password": "OutsiderPass123!"},
    )
    assert outsider_login.status_code == 200
    outsider_headers = {"Authorization": f"Bearer {outsider_login.json()['access_token']}"}

    # Attempt to view document from another tenant -> 404 (zero leakage)
    view_res = client.get(f"/api/documents/{sample_pdf_document.id}", headers=outsider_headers)
    assert view_res.status_code in [403, 404]

    # Attempt to download document from another tenant -> 404 / 403
    download_res = client.get(f"/api/documents/{sample_pdf_document.id}/download", headers=outsider_headers)
    assert download_res.status_code in [403, 404]


def test_audit_hash_chain_integrity_and_tamper_detection(
    client: TestClient, admin_user, db_session
):
    """
    1. Verify genuine audit events form a valid hash chain.
    2. Tamper with an event record directly in the DB.
    3. Verify engine successfully detects the tampering.
    """
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_user.email, "password": "SuperSecretAdminPass123!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 1. Trigger legitimate actions to build chain
    client.get("/api/admin/users", headers=admin_headers)
    client.get("/api/admin/documents", headers=admin_headers)

    # 2. Check initial verification -> MUST BE VALID
    verify_res = client.post("/api/admin/audit-logs/verify", headers=admin_headers)
    assert verify_res.status_code == 200
    report = verify_res.json()
    assert report["is_valid"] is True
    assert len(report["tampered_events"]) == 0

    # 3. Maliciously tamper with an audit record directly in the database
    target_event = (
        db_session.query(AuditEvent)
        .filter(AuditEvent.tenant_id == admin_user.tenant_id)
        .first()
    )
    assert target_event is not None
    original_details = target_event.details
    target_event.details = '{"tampered_field": "attacker_modified_value"}'
    db_session.commit()

    # 4. Run verification engine again -> MUST DETECT TAMPERING
    tamper_check = client.post("/api/admin/audit-logs/verify", headers=admin_headers)
    assert tamper_check.status_code == 200
    tamper_report = tamper_check.json()
    assert tamper_report["is_valid"] is False
    assert len(tamper_report["tampered_events"]) > 0
    assert tamper_report["tampered_events"][0]["error_type"] == "HASH_MISMATCH"

    # Restore clean state
    target_event.details = original_details
    db_session.commit()


def test_malicious_upload_signature_spoofing_rejected(
    client: TestClient, owner_user
):
    """
    An executable file (.exe / ELF) disguised with .pdf extension or fake MIME type
    must be rejected by magic byte file signature validation.
    """
    owner_login = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "SuperSecretOwnerPass123!"},
    )
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}

    # Spoofed file: Windows executable header (MZ) claiming to be a PDF
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00Malicious Executable Payload"
    res = client.post(
        "/api/documents/upload",
        headers=owner_headers,
        data={"title": "Trojan Disguised As PDF", "category": "General"},
        files={"file": ("malware.pdf", io.BytesIO(fake_pdf), "application/pdf")},
    )
    assert res.status_code == 400
    assert "File content signature does not match" in res.json()["detail"]
