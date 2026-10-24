import io
import pytest
from fastapi.testclient import TestClient

def test_document_owner_upload_and_viewer_access_flow(
    client: TestClient, owner_user, viewer_user
):
    """
    Complete lifecycle test:
    1. Owner logs in and uploads PDF.
    2. Viewer cannot access unshared document (403/404).
    3. Owner grants READ permission.
    4. Viewer can view and download document.
    5. Owner immediately revokes permission.
    6. Viewer is blocked on the subsequent request (403).
    """
    # 1. Login as Owner
    owner_login = client.post(
        "/api/auth/login",
        json={"email": owner_user.email, "password": "SuperSecretOwnerPass123!"},
    )
    owner_token = owner_login.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # 2. Login as Viewer
    viewer_login = client.post(
        "/api/auth/login",
        json={"email": viewer_user.email, "password": "SuperSecretViewerPass123!"},
    )
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # 3. Owner uploads PDF
    pdf_content = b"%PDF-1.4 Vaulted Enterprise Secrets\nTop Secret Classified Document."
    upload_res = client.post(
        "/api/documents/upload",
        headers=owner_headers,
        data={
            "title": "Project Aegis Security Protocol",
            "category": "Operations",
            "description": "Critical infrastructure defense instructions.",
        },
        files={"file": ("project_aegis.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 4. Viewer tries to view document before permission is granted -> 403 Forbidden
    view_unshared = client.get(f"/api/documents/{doc_id}", headers=viewer_headers)
    assert view_unshared.status_code == 403

    # Viewer tries to download unshared document -> 403 Forbidden
    download_unshared = client.get(f"/api/documents/{doc_id}/download", headers=viewer_headers)
    assert download_unshared.status_code == 403

    # 5. Owner grants READ permission to Viewer
    grant_res = client.post(
        f"/api/permissions/documents/{doc_id}/grant",
        headers=owner_headers,
        json={"user_id": viewer_user.id, "permission_level": "READ"},
    )
    assert grant_res.status_code == 201
    perm_id = grant_res.json()["id"]
    assert grant_res.json()["is_active"] is True

    # 6. Viewer can now view and download document
    view_shared = client.get(f"/api/documents/{doc_id}", headers=viewer_headers)
    assert view_shared.status_code == 200
    assert view_shared.json()["title"] == "Project Aegis Security Protocol"
    assert view_shared.json()["user_permission"] == "READ"

    download_shared = client.get(f"/api/documents/{doc_id}/download", headers=viewer_headers)
    assert download_shared.status_code == 200
    assert download_shared.content == pdf_content

    # 7. Viewer with READ permission cannot edit metadata -> 403 Forbidden
    edit_attempt = client.put(
        f"/api/documents/{doc_id}",
        headers=viewer_headers,
        json={"title": "Hacked Title"},
    )
    assert edit_attempt.status_code == 403

    # 8. Owner IMMEDIATELY REVOKES permission
    revoke_res = client.post(
        f"/api/permissions/{perm_id}/revoke",
        headers=owner_headers,
        json={"reason": "Security audit completed, access window expired."},
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["is_active"] is False

    # 9. Next immediate view request by Viewer MUST BE BLOCKED (403)
    blocked_view = client.get(f"/api/documents/{doc_id}", headers=viewer_headers)
    assert blocked_view.status_code == 403

    # Next immediate download request by Viewer MUST BE BLOCKED (403)
    blocked_download = client.get(f"/api/documents/{doc_id}/download", headers=viewer_headers)
    assert blocked_download.status_code == 403


def test_viewer_cannot_delete_document(client: TestClient, owner_user, viewer_user, sample_pdf_document):
    """Viewers cannot delete documents."""
    viewer_login = client.post(
        "/api/auth/login",
        json={"email": viewer_user.email, "password": "SuperSecretViewerPass123!"},
    )
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    del_res = client.delete(f"/api/documents/{sample_pdf_document.id}", headers=viewer_headers)
    assert del_res.status_code == 403
