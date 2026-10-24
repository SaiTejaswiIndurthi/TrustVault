import pytest
from fastapi.testclient import TestClient

def test_admin_approves_pending_user(client: TestClient, admin_user, pending_user):
    """Admin approves pending registration, enabling user to log in."""
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_user.email, "password": "SuperSecretAdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify pending user initially blocked
    initial_login = client.post(
        "/api/auth/login",
        json={"email": pending_user.email, "password": "SuperSecretPendingPass123!"},
    )
    assert initial_login.status_code == 403

    # Admin approves user
    approve_res = client.post(
        f"/api/admin/users/{pending_user.id}/status",
        headers=admin_headers,
        json={"status": "ACTIVE", "reason": "Verified corporate identity."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["new_status"] == "ACTIVE"

    # User can now successfully log in
    approved_login = client.post(
        "/api/auth/login",
        json={"email": pending_user.email, "password": "SuperSecretPendingPass123!"},
    )
    assert approved_login.status_code == 200


def test_admin_suspension_invalidates_active_sessions(client: TestClient, admin_user, viewer_user):
    """Admin suspending an active user immediately revokes all active sessions."""
    # 1. Viewer logs in
    viewer_login = client.post(
        "/api/auth/login",
        json={"email": viewer_user.email, "password": "SuperSecretViewerPass123!"},
    )
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # Verify viewer session active
    me_res = client.get("/api/auth/me", headers=viewer_headers)
    assert me_res.status_code == 200

    # 2. Admin logs in and suspends viewer
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_user.email, "password": "SuperSecretAdminPass123!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    suspend_res = client.post(
        f"/api/admin/users/{viewer_user.id}/status",
        headers=admin_headers,
        json={"status": "SUSPENDED", "reason": "Suspected credentials compromise."},
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["new_status"] == "SUSPENDED"

    # 3. Viewer's active session MUST BE REJECTED on subsequent request (401 or 403)
    post_suspend_check = client.get("/api/auth/me", headers=viewer_headers)
    assert post_suspend_check.status_code in [401, 403]


def test_admin_strictly_forbidden_from_downloading_document_content(
    client: TestClient, admin_user, sample_pdf_document
):
    """
    CRITICAL SECURITY REQUIREMENT:
    Separation of administrative duties.
    Administrators are strictly prohibited from downloading or accessing confidential document contents.
    """
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_user.email, "password": "SuperSecretAdminPass123!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 1. Admin can monitor document metadata
    meta_res = client.get("/api/admin/documents", headers=admin_headers)
    assert meta_res.status_code == 200
    docs = meta_res.json()
    assert any(d["id"] == sample_pdf_document.id for d in docs)

    # 2. Admin attempting to download confidential file MUST BE REJECTED WITH 403
    download_attempt = client.get(
        f"/api/documents/{sample_pdf_document.id}/download",
        headers=admin_headers,
    )
    assert download_attempt.status_code == 403
    assert "strictly prohibited" in download_attempt.json()["detail"]

    # 3. Admin attempting to access direct document view MUST BE REJECTED WITH 403
    view_attempt = client.get(
        f"/api/documents/{sample_pdf_document.id}",
        headers=admin_headers,
    )
    assert view_attempt.status_code == 403
