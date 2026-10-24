# TrustVault — REST API Reference

> Version: 1.0  
> Base URL (development): `http://localhost:8000/api`  
> Authentication: HttpOnly cookie `access_token` containing a signed JWT  
> Content-Type: `application/json` (unless noted)

---

## Authentication

All protected endpoints require the `access_token` cookie set by `POST /auth/login`.  
Send requests with `credentials: "include"` (Axios/Fetch). The backend validates the JWT, looks up the server-side session, checks it is not revoked, and verifies the user's `status == ACTIVE` on every request.

---

## Error Codes

| HTTP Status | Meaning |
|---|---|
| 400 | Validation error or bad request body |
| 401 | Not authenticated or session expired/revoked |
| 403 | Authenticated but not authorised for this action |
| 404 | Resource not found (or hidden for security) |
| 409 | Conflict (e.g. duplicate email) |
| 413 | File too large |
| 422 | Unprocessable entity (schema validation failed) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 1. Authentication Endpoints

### POST `/auth/register`

Register a new user account. Account is created with status `PENDING_APPROVAL`.

**Request body:**
```json
{
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "mobile_number": "+44 7911 123456",
  "password": "MySecurePass1!",
  "confirm_password": "MySecurePass1!",
  "role": "VIEWER",
  "captcha_token": "turnstile-or-recaptcha-response-token",
  "organization_name": "Acme Corp"
}
```

**Fields:**
- `role`: `VIEWER` or `DOCUMENT_OWNER` only. `ADMIN` is rejected.
- `captcha_token`: Required. Validated server-side. In dev mode (`CAPTCHA_PROVIDER=dev`), any value is accepted.

**Response `201`:**
```json
{
  "message": "Registration successful. Your account is pending administrator approval.",
  "status": "PENDING_APPROVAL"
}
```

**Errors:**
- `400` — Password mismatch or weak password
- `409` — Email already registered
- `422` — Validation error
- `403` — CAPTCHA validation failed

---

### POST `/auth/login`

Authenticate with email and password. Returns an HttpOnly cookie.

**Request body:**
```json
{
  "email": "jane@example.com",
  "password": "MySecurePass1!",
  "captcha_token": "optional-token"
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "full_name": "Jane Smith",
    "role": "VIEWER",
    "status": "ACTIVE"
  }
}
```

Sets cookie: `access_token=<jwt>; HttpOnly; SameSite=Lax; Path=/`

**Errors:**
- `401` — Invalid credentials (generic message; does not reveal which field is wrong)
- `401` — Account not active (PENDING / SUSPENDED / REJECTED — generic message)
- `429` — Rate limit exceeded (5 failed attempts per 5 minutes)

---

### POST `/auth/logout`

Revoke the current session. The session is immediately marked as revoked in the database.

**Response `200`:**
```json
{ "message": "Logged out successfully" }
```

Clears `access_token` cookie.

---

### GET `/auth/me`

Return the currently authenticated user's profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "jane@example.com",
  "full_name": "Jane Smith",
  "mobile_number": "+44 7911 123456",
  "role": "VIEWER",
  "status": "ACTIVE",
  "tenant_id": "uuid"
}
```

**Errors:**
- `401` — Not authenticated

---

### POST `/auth/forgot-password`

Request a password-reset link. Sends a notification (email in production). Always returns 200 to prevent user enumeration.

**Request body:**
```json
{ "email": "jane@example.com" }
```

**Response `200`:**
```json
{ "message": "If that email is registered, a reset link has been sent." }
```

> In development mode, the response also includes `"dev_token": "<plaintext-token>"` for testing.

---

### POST `/auth/reset-password`

Reset password using a valid reset token. Invalidates all existing sessions for the user.

**Request body:**
```json
{
  "token": "the-plaintext-token-from-email",
  "new_password": "NewSecurePass2!"
}
```

**Response `200`:**
```json
{ "message": "Password reset successful. Please log in again." }
```

**Errors:**
- `400` — Token invalid, expired (1 hour), or already used

---

## 2. Document Endpoints

### POST `/documents/upload`

Upload a new document. **Document Owner only.**

**Content-Type:** `multipart/form-data`

**Form fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | The document file |
| `title` | string | Yes | Document title |
| `description` | string | No | Optional description |
| `category` | string | No | Category label |

**Validation:**
- Allowed extensions: `pdf`, `png`, `jpg`, `jpeg`, `docx`, `xlsx`, `txt`
- Max size: configurable (default 50 MB)
- Magic-byte signature must match file extension

**Response `201`:**
```json
{
  "id": "uuid",
  "title": "Q3 Financial Report",
  "description": "Confidential",
  "category": "Finance",
  "original_filename": "q3-report.pdf",
  "mime_type": "application/pdf",
  "file_size": 204800,
  "owner_id": "uuid",
  "tenant_id": "uuid",
  "is_archived": false,
  "is_deleted": false,
  "created_at": "2026-10-24T10:00:00Z",
  "updated_at": "2026-10-24T10:00:00Z"
}
```

**Errors:**
- `400` — Invalid file type, signature mismatch, or unsafe filename
- `413` — File too large
- `403` — Not a Document Owner

---

### GET `/documents/`

List documents accessible to the current user.

- **Owner:** Returns all non-deleted documents they own.
- **Viewer:** Returns only documents explicitly shared with them (active `DocumentPermission`). Zero unshared documents appear — even in counts.

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category |
| `search` | string | Search title and description |
| `skip` | int | Pagination offset (default 0) |
| `limit` | int | Page size (default 50, max 100) |

**Response `200`:**
```json
{
  "documents": [ { /* DocumentResponse */ } ],
  "total": 12
}
```

---

### GET `/documents/{document_id}`

Get document metadata. **Admin is blocked** (403) — separation of duties.

**Response `200`:** Single `DocumentResponse` object.

**Errors:**
- `403` — Admin attempting to access content metadata
- `403` — Viewer without an active permission grant
- `404` — Document not found or belongs to another tenant

---

### GET `/documents/{document_id}/download`

Download document file contents. **Admin is blocked** (403).

Every download is logged as a `DOCUMENT_DOWNLOADED` audit event.

**Response `200`:** Binary file stream with appropriate `Content-Type` and `Content-Disposition: attachment` header.

**Errors:**
- `403` — Admin or viewer without active permission
- `404` — Document not found

---

### PUT `/documents/{document_id}`

Update document metadata. **Document Owner only.**

**Request body:**
```json
{
  "title": "Updated Title",
  "description": "New description",
  "category": "Legal",
  "is_archived": false
}
```

**Response `200`:** Updated `DocumentResponse`.

---

### DELETE `/documents/{document_id}`

Soft-delete a document. **Document Owner only.** Marks `is_deleted = True`; does not erase the file immediately (audit trail preserved).

**Response `200`:**
```json
{ "message": "Document deleted successfully" }
```

---

### GET `/documents/stats/owner`

Return aggregate statistics for the current Document Owner. **Owner only.**

**Response `200`:**
```json
{
  "total_documents": 15,
  "shared_documents": 7,
  "active_permissions": 12,
  "recent_events": [ /* last 10 audit events */ ]
}
```

---

### GET `/documents/stats/viewer`

Return aggregate statistics for the current Viewer. **Viewer only.**

**Response `200`:**
```json
{
  "accessible_documents": 3,
  "recent_activity": [ /* last 5 audit events */ ]
}
```

---

## 3. Permission Endpoints

### POST `/permissions/`

Grant a registered active user access to a document. **Document Owner only.**

**Request body:**
```json
{
  "document_id": "uuid",
  "grantee_email": "viewer@example.com",
  "permission_type": "READ"
}
```

- `permission_type`: `READ` or `EDIT`
- Grantee must be an active user in the **same tenant**
- If a previous grant exists for the same document+grantee, it is reactivated

**Response `201`:**
```json
{
  "id": "uuid",
  "document_id": "uuid",
  "grantee_id": "uuid",
  "grantee_email": "viewer@example.com",
  "permission_type": "READ",
  "is_active": true,
  "granted_at": "2026-10-24T10:00:00Z",
  "revoked_at": null
}
```

**Errors:**
- `403` — Not the document owner
- `404` — Document or grantee not found
- `400` — Grantee is not in the same tenant or is not active

---

### DELETE `/permissions/{permission_id}`

Revoke an active permission grant. **Document Owner only.** Takes effect **immediately** — the grantee's next API request will receive 403.

**Response `200`:**
```json
{ "message": "Permission revoked successfully" }
```

---

### GET `/permissions/document/{document_id}`

List all permission grants for a document. **Document Owner only.**

**Response `200`:**
```json
{
  "permissions": [ { /* PermissionResponse */ } ]
}
```

---

### GET `/permissions/document/{document_id}/activity`

Timeline of all access events for a document (uploads, downloads, permission grants/revocations, edits, deletes). **Document Owner only.**

**Response `200`:**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "DOCUMENT_DOWNLOADED",
      "actor_id": "uuid",
      "timestamp": "2026-10-24T10:05:00Z",
      "metadata": { "ip": "127.0.0.1" }
    }
  ]
}
```

---

### GET `/permissions/users/shareable`

List active users in the same tenant that the current owner can share documents with. **Document Owner only.**

**Response `200`:**
```json
{
  "users": [
    { "id": "uuid", "email": "viewer@example.com", "full_name": "John Doe", "role": "VIEWER" }
  ]
}
```

---

## 4. Admin Endpoints

All admin endpoints require `role == ADMIN`. Non-admin requests receive `403`.

### GET `/admin/stats`

Aggregate dashboard statistics.

**Response `200`:**
```json
{
  "total_users": 42,
  "total_documents": 128,
  "pending_approvals": 3,
  "active_sessions": 15,
  "audit_events_today": 87,
  "denied_access_attempts_today": 4
}
```

---

### GET `/admin/users`

List all users in the tenant with pagination and search.

**Query parameters:** `skip`, `limit`, `search`, `status`, `role`

**Response `200`:**
```json
{
  "users": [ { /* UserAdminResponse (no password fields) */ } ],
  "total": 42
}
```

---

### PUT `/admin/users/{user_id}/status`

Update a user's account status. Triggers notifications. Suspension immediately revokes all active sessions.

**Request body:**
```json
{ "status": "ACTIVE" }
```

- `status`: `ACTIVE`, `REJECTED`, or `SUSPENDED`

**Response `200`:**
```json
{ "message": "User status updated to ACTIVE" }
```

---

### GET `/admin/documents`

List document metadata across the tenant. **Admin cannot download or view document contents.** This endpoint returns metadata only.

**Response `200`:**
```json
{
  "documents": [ { /* DocumentMetadataResponse (no storage_key) */ } ],
  "total": 128
}
```

---

### GET `/admin/permissions`

List all permission grants across the tenant.

**Response `200`:**
```json
{
  "permissions": [ { /* PermissionResponse */ } ],
  "total": 250
}
```

---

### GET `/admin/audit`

Query the audit event log with filtering.

**Query parameters:** `skip`, `limit`, `event_type`, `actor_id`, `resource_id`, `from_date`, `to_date`

**Response `200`:**
```json
{
  "events": [ { /* AuditEventResponse */ } ],
  "total": 1042
}
```

---

### GET `/admin/audit/verify`

Run cryptographic verification of the audit hash chain for the current tenant.

**Response `200`:**
```json
{
  "verified": true,
  "total_events": 87,
  "message": "Audit chain integrity verified. No tampering detected."
}
```

**Response when tampered:**
```json
{
  "verified": false,
  "total_events": 87,
  "message": "Chain integrity violation detected at sequence 43: hash mismatch"
}
```

---

## 5. Audit Event Types

| Event Type | Triggered by |
|---|---|
| `USER_REGISTERED` | Registration |
| `USER_APPROVED` | Admin approves account |
| `USER_REJECTED` | Admin rejects account |
| `USER_SUSPENDED` | Admin suspends account |
| `USER_LOGIN` | Successful login |
| `USER_LOGOUT` | Logout |
| `USER_LOGIN_FAILED` | Failed login attempt |
| `PASSWORD_RESET_REQUESTED` | Forgot password |
| `PASSWORD_RESET_COMPLETED` | Successful password reset |
| `DOCUMENT_UPLOADED` | File upload |
| `DOCUMENT_VIEWED` | Document metadata accessed |
| `DOCUMENT_DOWNLOADED` | File downloaded |
| `DOCUMENT_UPDATED` | Metadata edited |
| `DOCUMENT_DELETED` | Soft delete |
| `PERMISSION_GRANTED` | Access granted to a user |
| `PERMISSION_REVOKED` | Access revoked from a user |

---

## 6. OpenAPI Documentation

The live, interactive API documentation is available when the backend is running:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`
