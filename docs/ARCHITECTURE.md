# TrustVault — System Architecture

> Version: 1.0  
> Last updated: 2026-10-24

---

## 1. High-Level Overview

TrustVault is a **multi-tenant, role-based secure document-sharing platform** built with a clean separation between frontend, backend, and storage layers.

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                       │
│   React SPA (Vite) — served from /dist by FastAPI       │
│   Communicates only with /api/* endpoints               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS (JWT in HttpOnly cookie)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 FastAPI Application                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Auth   │ │Documents │ │Permissions│ │  Admin  │  │
│  │  Router  │ │  Router  │ │  Router  │ │  Router  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │             │             │             │        │
│  ┌────▼─────────────▼─────────────▼─────────────▼─────┐│
│  │         Security & Dependency Layer                 ││
│  │  get_current_user · require_admin · require_owner   ││
│  │  enforce_login_rate_limit · CAPTCHA validation      ││
│  └────────────────────────┬────────────────────────────┘│
│                           │                              │
│  ┌────────────────────────▼────────────────────────────┐│
│  │                SQLAlchemy ORM                        ││
│  │   Tenant · User · Session · Document · Permission   ││
│  │   AuditEvent · Notification · PasswordResetToken    ││
│  └────────────────────────┬────────────────────────────┘│
└───────────────────────────┼─────────────────────────────┘
                            │
          ┌─────────────────┴────────────────┐
          ▼                                  ▼
  ┌──────────────┐                 ┌──────────────────────┐
  │  PostgreSQL  │                 │  Private File Store  │
  │  (or SQLite  │                 │  backend/storage/    │
  │   in dev)    │                 │  vault/{tenant}/{uuid}│
  └──────────────┘                 └──────────────────────┘
```

---

## 2. Component Descriptions

### 2.1 Frontend (React + Vite)

| Module | Purpose |
|---|---|
| `src/context/AuthContext.jsx` | Global authentication state; login, logout, refreshUser |
| `src/services/api.js` | Typed Axios client; attaches credentials, handles blob downloads |
| `src/components/Logo.jsx` | Custom SVG shield+lock TrustVault logo |
| `src/components/Navbar.jsx` | Notification bell, unread count, role badge, logout |
| `src/components/CaptchaWidget.jsx` | Wraps Turnstile/reCAPTCHA; dev-mode banner |
| `src/components/Modal.jsx` | Reusable accessible modal dialog |
| `src/pages/Login.jsx` | Split-screen auth layout; CAPTCHA; generic errors |
| `src/pages/Register.jsx` | Full registration form; password strength meter |
| `src/pages/ForgotPassword.jsx` | Email submission; dev-mode token display |
| `src/pages/ResetPassword.jsx` | Token + new password submission |
| `src/pages/AdminDashboard.jsx` | Metrics, user approvals, doc metadata, audit chain |
| `src/pages/OwnerDashboard.jsx` | Upload, permissions, activity history, document table |
| `src/pages/ViewerDashboard.jsx` | Permission-filtered doc list, view/download |
| `src/App.jsx` | Route dispatcher based on authenticated role |

The frontend is built with Vite into `frontend/dist/`. FastAPI serves the built SPA as static files and falls back to `index.html` for all non-API routes to enable client-side routing.

### 2.2 Backend (FastAPI + SQLAlchemy)

| Module | Purpose |
|---|---|
| `app/main.py` | FastAPI app factory; CORS, middleware, router registration, SPA serving |
| `app/config.py` | Pydantic-settings configuration; env var loading |
| `app/database.py` | SQLAlchemy engine, session factory, FK enforcement |
| `app/models.py` | All ORM models (8 tables) |
| `app/schemas.py` | Pydantic request/response schemas |
| `app/dependencies.py` | Shared FastAPI dependencies (auth, rate limit) |
| `app/routers/auth.py` | Registration, login, logout, password reset |
| `app/routers/documents.py` | Upload, list, get, download, update, delete |
| `app/routers/permissions.py` | Grant, revoke, list, activity timeline |
| `app/routers/admin.py` | Dashboard stats, user management, audit explorer |
| `app/security/passwords.py` | Argon2id password hashing and verification |
| `app/security/tokens.py` | JWT creation/decode, secure token generation |
| `app/security/captcha.py` | CAPTCHA provider abstraction (dev/Turnstile/reCAPTCHA) |
| `app/security/audit_chain.py` | SHA-256 hash-chained audit event recording + verification |
| `app/storage/local_storage.py` | File validation, UUID key generation, streaming download |

---

## 3. Database Schema

### 3.1 Entity-Relationship Overview

```
Tenant (1) ──< User (many)
Tenant (1) ──< Document (many)

User (1, owner) ──< Document (many)
User (1) ──< DbSession (many)
User (1) ──< PasswordResetToken (many)
User (1) ──< AuditEvent (many, as actor)
User (1) ──< Notification (many)

Document (1) ──< DocumentPermission (many)
User (1, grantee) ──< DocumentPermission (many)

AuditEvent (1) ── references Document (nullable)
AuditEvent (1) ── references DocumentPermission (nullable)
```

### 3.2 Key Tables

**`tenants`** — Organisation records. All data is isolated by `tenant_id`.

**`users`**
- `id`, `tenant_id`, `email` (unique per tenant), `hashed_password`
- `role`: `ADMIN`, `DOCUMENT_OWNER`, `VIEWER`
- `status`: `PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, `SUSPENDED`
- Password field never returned in API responses (excluded from schemas)

**`sessions`**
- Server-side sessions: `session_id` (UUID), `user_id`, `is_revoked`, `expires_at`
- JWT wraps only the `session_id`; backend looks up the session in DB on every request
- Revocation sets `is_revoked = True`; subsequent requests get 401

**`documents`**
- `id`, `tenant_id`, `owner_id`, `title`, `description`, `category`
- `original_filename`, `storage_key` (UUID — maps to physical file), `mime_type`, `file_size`
- `is_archived`, `is_deleted` — soft delete with audit trail

**`document_permissions`**
- `id`, `document_id`, `grantee_id`, `permission_type` (`READ` / `EDIT`)
- `is_active` — set to `False` on revocation (immediate effect)
- `granted_by_id`, `granted_at`, `revoked_at`

**`audit_events`**
- `id`, `tenant_id`, `actor_id`, `event_type`, `resource_type`, `resource_id`
- `metadata` (JSON), `ip_address`, `timestamp`
- `sequence` (per-tenant auto-increment), `previous_hash`, `event_hash`
- Hash chain: `event_hash = SHA-256(previous_hash + canonical_event_data)`

**`password_reset_tokens`**
- `token_hash` (SHA-256 of the random token), `user_id`, `expires_at`, `is_used`

**`notifications`**
- `id`, `user_id`, `title`, `body`, `is_read`, `created_at`

---

## 4. Authentication Flow

```
Client                          FastAPI                        Database
  │                                │                               │
  │── POST /api/auth/login ────────▶│                               │
  │   {email, password, captcha}   │── CAPTCHA verification ──────▶│ (external)
  │                                │── SELECT user WHERE email ────▶│
  │                                │◀── user row ──────────────────│
  │                                │── verify Argon2id hash        │
  │                                │── check status == ACTIVE      │
  │                                │── INSERT sessions row ────────▶│
  │                                │◀── session_id ────────────────│
  │                                │── sign JWT(session_id)        │
  │◀── 200 + Set-Cookie(access_token, HttpOnly) ──────────────────│
  │                                │                               │
  │── GET /api/documents/ ─────────▶│                               │
  │   Cookie: access_token=<jwt>   │── decode JWT → session_id    │
  │                                │── SELECT sessions WHERE id   ─▶│
  │                                │   AND NOT is_revoked         │
  │                                │   AND expires_at > now()     │
  │                                │◀── session row ───────────────│
  │                                │── SELECT user WHERE id ───────▶│
  │                                │── check user.status == ACTIVE │
  │                                │── filter docs by permission ──▶│
  │◀── 200 {documents: [...]} ─────│                               │
```

---

## 5. Document Storage Architecture

```
POST /api/documents/upload
  │
  ├── Validate extension (allowlist: pdf, png, jpg, jpeg, docx, xlsx, txt)
  ├── Read first 16 bytes → check magic bytes (PDF: %PDF, PNG: 0x89PNG, etc.)
  ├── Validate MIME type matches detected signature
  ├── Sanitise original filename (secure_filename)
  ├── Generate storage_key = UUID4()
  │
  ├── Write file to: backend/storage/vault/{tenant_id}/{storage_key}
  │   (directory is NOT web-served; no public URL)
  │
  ├── INSERT document row (metadata + storage_key)
  └── INSERT audit_event (DOCUMENT_UPLOADED)

GET /api/documents/{id}/download
  │
  ├── Validate session → get current user
  ├── Check role != ADMIN (403 if admin)
  ├── Load document row
  ├── If owner: proceed
  ├── If viewer: check active DocumentPermission exists
  ├── Construct path: backend/storage/vault/{tenant_id}/{storage_key}
  ├── Open file in binary mode → stream as FileResponse / StreamingResponse
  └── INSERT audit_event (DOCUMENT_DOWNLOADED)
```

Files never leave the server except through the download endpoint. No presigned URLs, no public buckets, no direct filesystem access.

---

## 6. Audit Chain Design

The audit log uses a **SHA-256 hash chain** to detect post-hoc tampering:

```
Event 1:
  previous_hash = "0000...0000" (genesis)
  canonical = f"{seq}|{timestamp}|{actor_id}|{event_type}|{resource_id}|{metadata}"
  event_hash = SHA256(previous_hash + canonical)

Event 2:
  previous_hash = event_1.event_hash
  canonical = ...
  event_hash = SHA256(previous_hash + canonical)

Event N:
  previous_hash = event_{N-1}.event_hash
  ...
```

**Verification** (`GET /api/admin/audit/verify`):
1. Load all events for a tenant ordered by `sequence`
2. Recompute each `event_hash` from scratch
3. Compare to stored `event_hash` — mismatch → row was modified
4. Compare `previous_hash` chain linkage — break → row was deleted or reordered
5. Check sequence numbers for gaps — gap → row was deleted

This detects:
- ✅ Modification of any field in any row
- ✅ Deletion of individual rows
- ✅ Reordering of rows
- ⚠️ Cannot detect wholesale DB replacement with a correctly computed new chain (see THREATS.md §6.3)

---

## 7. Tenant Isolation Model

Every database query that touches user-owned data is filtered by `tenant_id`:

```python
# Documents — list
db.query(Document).filter(
    Document.tenant_id == current_user.tenant_id,
    ...
)

# Permissions — grant
# Both document and grantee must be in the same tenant
assert document.tenant_id == current_user.tenant_id
assert grantee.tenant_id == current_user.tenant_id
```

`tenant_id` is derived from the authenticated session → user → `user.tenant_id`. It is **never** supplied by the client request.

Cross-tenant scenarios produce:
- `404 Not Found` — resource does not appear to exist (preferred; prevents enumeration)
- `403 Forbidden` — used where resource existence can be safely disclosed

---

## 8. Security Header Middleware

The following headers are set on every response by FastAPI middleware:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (production) |

Content-Security-Policy is set conservatively and allows `'self'` plus the configured CDN for fonts and icons.

---

## 9. Deployment Architecture

### Development
```
npm run dev (port 5173)
  └── Vite proxy /api/* → localhost:8000

uvicorn backend.app.main:app --port 8000 --reload
  └── SQLite database
  └── backend/storage/vault/ (local filesystem)
```

### Production (Docker)
```
┌─────────────────────────────────────┐
│  nginx (reverse proxy + TLS)        │
│  Port 443 → Docker network          │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  trustvault-api container           │
│  uvicorn backend.app.main:app       │
│  Port 8000                          │
│  Volumes:                           │
│    vault_storage → /app/backend/    │
│                    storage/vault/   │
│    sqlite_data   → /app/trustvault.db│
└─────────────────────────────────────┘
```

Production environment variables (`.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — 64-byte random hex
- `CAPTCHA_PROVIDER` — `turnstile` or `recaptcha`
- `CAPTCHA_SECRET_KEY` — Provider secret
- `FRONTEND_URL` — Allowed CORS origin
- `ENVIRONMENT` — `production` (enables HTTPS cookies, HSTS)

---

## 10. Technology Decisions

| Decision | Rationale |
|---|---|
| FastAPI over Flask/Django | Async-capable, automatic OpenAPI docs, Pydantic validation built-in |
| Argon2id over bcrypt/PBKDF2 | Memory-hard; recommended by OWASP Password Storage Cheat Sheet |
| Server-side sessions with JWT wrapper | Enables immediate revocation (unlike stateless JWT alone) |
| SQLAlchemy ORM | Parameterised queries prevent SQL injection; easy PostgreSQL migration |
| SHA-256 hash chain for audit | Lightweight tamper detection without an external SIEM dependency |
| UUID storage keys | Prevents filename-based enumeration and path traversal |
| Magic-byte + MIME validation | Prevents MIME spoofing (e.g., renaming an EXE to .pdf) |
| React + Vite SPA | Fast development, tree-shaking, easy API abstraction |
| Single-process Docker | Appropriate for v1.0; scale-out requires Redis for rate limiting |
