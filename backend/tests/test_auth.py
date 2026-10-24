import pytest
from fastapi.testclient import TestClient

def test_unauthenticated_requests_rejected(client: TestClient):
    """Unauthenticated access to protected routes must be rejected with 401."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "detail" in res.json()

    res = client.get("/api/documents")
    assert res.status_code == 401

    res = client.get("/api/admin/users")
    assert res.status_code == 401


def test_registration_success_sets_pending_status(client: TestClient):
    """Registration creates account in PENDING_APPROVAL status."""
    payload = {
        "full_name": "Jonathan Archer",
        "email": "archer@starfleet.com",
        "phone_number": "+1-555-401-2099",
        "password": "StrongPassword99!",
        "confirm_password": "StrongPassword99!",
        "role": "VIEWER",
        "tenant_name": "Starfleet Command",
        "captcha_token": "TRUSTVAULT_DEV_CAPTCHA_PASSED",
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["account_status"] == "PENDING_APPROVAL"


def test_registration_invalid_captcha_rejected(client: TestClient):
    """Invalid or missing CAPTCHA token must reject registration with 400."""
    payload = {
        "full_name": "Fake Bot",
        "email": "bot@spam.com",
        "phone_number": "+1-555-401-2099",
        "password": "StrongPassword99!",
        "confirm_password": "StrongPassword99!",
        "role": "VIEWER",
        "tenant_name": "Starfleet Command",
        "captcha_token": "INVALID_FORGED_CAPTCHA_TOKEN",
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "CAPTCHA verification failed" in res.json()["detail"]


def test_registration_role_escalation_blocked(client: TestClient):
    """Users cannot self-register as ADMIN."""
    payload = {
        "full_name": "Malicious Actor",
        "email": "hacker@evil.com",
        "phone_number": "+1-555-401-2099",
        "password": "StrongPassword99!",
        "confirm_password": "StrongPassword99!",
        "role": "ADMIN",
        "tenant_name": "Starfleet Command",
        "captcha_token": "TRUSTVAULT_DEV_CAPTCHA_PASSED",
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 422 or res.status_code == 400


def test_login_active_user_succeeds(client: TestClient, owner_user):
    """Active user can log in and receives HttpOnly session cookie and token."""
    res = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "SuperSecretOwnerPass123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["user"]["email"] == owner_user.email
    assert data["user"]["role"] == "DOCUMENT_OWNER"
    # Verify HttpOnly cookie
    assert "trustvault_session" in res.cookies


def test_login_pending_user_blocked(client: TestClient, pending_user):
    """Users in PENDING_APPROVAL status cannot log in."""
    res = client.post(
        "/api/auth/login",
        json={"email": pending_user.email, "password": "SuperSecretPendingPass123!"},
    )
    assert res.status_code == 403
    assert "pending administrator approval" in res.json()["detail"]


def test_login_suspended_user_blocked(client: TestClient, suspended_user):
    """Users in SUSPENDED status cannot log in."""
    res = client.post(
        "/api/auth/login",
        json={"email": suspended_user.email, "password": "SuperSecretSuspendedPass123!"},
    )
    assert res.status_code == 403
    assert "suspended" in res.json()["detail"]


def test_login_wrong_password_generic_error(client: TestClient, owner_user):
    """Failed login returns generic error without leaking account state."""
    res = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "WrongPassword99!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."


def test_password_reset_invalidates_active_sessions(client: TestClient, owner_user):
    """Resetting password must immediately invalidate all existing sessions."""
    # 1. Log in to establish session
    login_res = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "SuperSecretOwnerPass123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 2. Verify session works
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    # 3. Request password reset
    forgot_res = client.post(
        "/api/auth/forgot-password",
        json={"email": owner_user.email, "captcha_token": "TRUSTVAULT_DEV_CAPTCHA_PASSED"},
    )
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json()["dev_reset_token"]
    assert reset_token is not None

    # 4. Perform password reset
    reset_res = client.post(
        "/api/auth/reset-password",
        json={
            "token": reset_token,
            "new_password": "NewBrandPassword123!",
            "confirm_password": "NewBrandPassword123!",
        },
    )
    assert reset_res.status_code == 200

    # 5. Security check: previous active session token MUST NOW BE INVALIDATED (401)
    revoked_check = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert revoked_check.status_code == 401

    # 6. User can log in with new password
    new_login = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "NewBrandPassword123!"},
    )
    assert new_login.status_code == 200
