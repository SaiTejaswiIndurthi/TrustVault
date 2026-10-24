# TrustVault — Threat Model

> Last updated: 2026-10-24  
> Status: Production-candidate v1.0

---

## 1. Application Overview

TrustVault is a multi-tenant, role-based secure document-sharing platform.  
Users belong to tenant organisations. Documents are privately stored outside the web root. Access is controlled by per-document permission records enforced by the backend on every request.

### Key Assets

| Asset | Description | Sensitivity |
|---|---|---|
| Document contents | Confidential files uploaded by Document Owners | Critical |
| Document metadata | Filename, category, owner, timestamps | High |
| User credentials | Email + Argon2id password hash | High |
| Session tokens | JWT wrapping server-side session ID | High |
| Password-reset tokens | SHA-256-hashed single-use tokens | High |
| Audit event chain | Tamper-evident sequence of security events | High |
| User PII | Full name, email, mobile number | Medium |
| Permission grants | Who can access which document | High |

---

## 2. Threat Actors

| Actor | Capability | Motivation |
|---|---|---|
| External attacker | Internet access, automated tooling | Exfiltrate confidential documents or credentials |
| Malicious registered user (Viewer) | Valid session, viewer-scoped API | Access documents not shared with them; escalate privilege |
| Malicious Document Owner | Valid session, owner-scoped API | Access other tenants' documents; bypass permission revocation |
| Insider administrator | Admin panel access | Read document content they are not authorised to view; cover activity traces |
| Compromised session | Stolen JWT or cookie | Act as victim user across all permitted operations |
| Audit adversary | Direct DB write access | Falsify or erase audit history post-incident |

---

## 3. STRIDE Threat Analysis

### 3.1 Spoofing

| Threat | Control |
|---|---|
| Credential stuffing against login | Rate limiting: 5 failed attempts per 5-minute window → 429; generic error messages hide valid email enumeration |
| Session token theft from cookie jar | `HttpOnly` + `Secure` + `SameSite=Lax` cookies; short JWT lifetime (60 min default) |
| Password-reset link hijacking | Tokens are 32-byte cryptographically-random, stored as SHA-256 hashes; single-use; 1-hour expiry; invalidated on use |
| JWT algorithm confusion (alg:none) | PyJWT decodes with explicit algorithm list; `alg:none` is never accepted |
| Role claim forgery in JWT | Backend verifies role from `users` table on every protected request; JWT role claim is not trusted alone |

### 3.2 Tampering

| Threat | Control |
|---|---|
| Tampered document during upload | MIME-type + magic-byte signature validation server-side; storage key is a server-generated UUID |
| Path traversal in filename | `secure_filename()` sanitisation + UUID storage key; no user-supplied path reaches the filesystem |
| Audit log manipulation in DB | SHA-256 hash-chained audit events; `/api/admin/audit/verify` detects modification, deletion, reordering, and sequence gaps |
| Modified JWT payload | HS256 HMAC signature; signed with server-held `SECRET_KEY` |
| CSRF token forgery | `SameSite=Lax` cookie policy prevents cross-site form submission for state-changing requests |

### 3.3 Repudiation

| Threat | Control |
|---|---|
| User denies uploading or sharing a document | Every upload, share, revoke, download, delete produces an `AuditEvent` row with user ID, timestamp, and chained hash |
| Administrator denies approval/rejection action | Admin actions recorded in audit log with actor user ID |
| Dispute over when access was revoked | Revocation recorded as `PERMISSION_REVOKED` event before the permission row is marked inactive |

### 3.4 Information Disclosure

| Threat | Control |
|---|---|
| Viewer accesses unshared document | List endpoint filters by active `DocumentPermission`; get/download re-checks permission; backend returns 403 |
| Viewer sees document count or filenames from unshared docs | List endpoint returns exactly the permission-filtered set; no total-document count exposed; search never leaks unshared metadata |
| Cross-tenant document access | Every query filters by `tenant_id` derived from session; no cross-tenant joins |
| Admin reads document content | `/api/documents/{id}` and `/api/documents/{id}/download` return 403 for admin role |
| Error messages expose internal paths | FastAPI exception handlers return generic messages; stack traces suppressed in production (`DEBUG=false`) |
| Storage URL enumeration | Files stored with UUID keys under a private non-web-served directory; no public URLs ever generated |
| Password hash disclosure | Password field excluded from all API response schemas |
| User enumeration via registration | Registration returns the same `PENDING_APPROVAL` message whether the email is new or already taken (email collision returns 409 only for genuinely duplicate registrations — acceptable trade-off; see §6 residual risks) |

### 3.5 Denial of Service

| Threat | Control |
|---|---|
| Login flood | Rate limiter: 5 attempts / 5 min, 429 with `Retry-After` header |
| Large file upload exhausting disk | Configurable `MAX_FILE_SIZE_MB` (default 50 MB); FastAPI request-size limit |
| Malformed upload attacking MIME parser | Magic-byte check reads only first 16 bytes; does not execute or parse the file |
| Recursive archive bomb | Not fully mitigated in v1.0 (see §6 residual risks) |

### 3.6 Elevation of Privilege

| Threat | Control |
|---|---|
| PENDING user bypasses approval to login | Login checks `user.status == ACTIVE`; PENDING, SUSPENDED, REJECTED → 401 |
| Viewer attempts owner-only endpoint | `require_document_owner` dependency enforces role at the router level |
| Viewer attempts cross-document permission grant | Grant endpoint restricted to document owner only |
| Public registration requesting admin role | Registration only creates `VIEWER` or `DOCUMENT_OWNER` accounts; admin provisioning requires a separate trusted workflow |
| Session not invalidated after suspension | Session revocation sets `DbSession.is_revoked = True`; every protected request re-validates the session from the database |
| Concurrent permission revocation race | Revocation marks `is_active = False` atomically in the same DB transaction; subsequent access checks read the committed state |

---

## 4. Attack Surface

```
Internet
  │
  ▼
[ HTTPS Reverse Proxy / Load Balancer ]
  │  TLS termination, security headers, rate limiting at edge
  │
  ▼
[ FastAPI Application ]
  ├── POST /api/auth/register        — CAPTCHA + rate limit
  ├── POST /api/auth/login           — rate limit + generic errors
  ├── POST /api/auth/logout          — session revocation
  ├── POST /api/auth/forgot-password — rate limit
  ├── POST /api/auth/reset-password  — single-use token
  ├── GET  /api/auth/me              — session validation
  │
  ├── POST /api/documents/upload     — owner only, MIME + sig validation
  ├── GET  /api/documents/           — permission-filtered list
  ├── GET  /api/documents/{id}       — permission check (admin blocked)
  ├── GET  /api/documents/{id}/download — permission check (admin blocked)
  ├── PUT  /api/documents/{id}       — owner only
  ├── DELETE /api/documents/{id}     — owner only
  │
  ├── POST /api/permissions/         — owner only
  ├── DELETE /api/permissions/{id}   — owner only
  ├── GET  /api/permissions/document/{id} — owner only
  ├── GET  /api/permissions/document/{id}/activity — owner only
  │
  ├── GET  /api/admin/stats          — admin only
  ├── GET  /api/admin/users          — admin only
  ├── PUT  /api/admin/users/{id}/status — admin only
  ├── GET  /api/admin/documents      — admin only (metadata only)
  ├── GET  /api/admin/permissions    — admin only
  ├── GET  /api/admin/audit          — admin only
  ├── GET  /api/admin/audit/verify   — admin only
  │
  └── GET  /*                        — SPA static files (no auth)

[ SQLAlchemy ORM ] ─── [ SQLite / PostgreSQL ]

[ Local storage: backend/storage/vault/{tenant_id}/{uuid_key} ]
    Not web-served. Accessed only through the download endpoint.
```

---

## 5. Security Controls Summary

| Control | Implementation |
|---|---|
| Password hashing | Argon2id, time=3, mem=65536 KiB, p=4 |
| Session management | Server-side DB session; JWT wraps session ID; revocation flips DB flag |
| Cookie attributes | HttpOnly, Secure (prod), SameSite=Lax |
| CAPTCHA | Cloudflare Turnstile or reCAPTCHA; server-side validation only |
| Rate limiting | In-memory sliding window, 5/5 min login attempts |
| CORS | Restrictive: only configured FRONTEND_URL origin |
| Input validation | Pydantic schemas + email-validator + phone format checks |
| File validation | Extension allowlist + magic-byte signature check |
| Storage | Private directory with UUID keys; no public URLs |
| Audit chain | SHA-256 chained hash; verification endpoint |
| Tenant isolation | All queries filtered by session-derived tenant_id |
| Admin content block | Role check in download/get endpoints |
| Security headers | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS (prod) |

---

## 6. Residual Risks and Documented Limitations

### 6.1 Rate Limiter In-Memory State

**Risk:** The rate limiter uses a Python `defaultdict` in process memory. On server restart (or in multi-worker deployments), counters reset.  
**Impact:** An attacker who restarts the process or hits a different worker process can reset their attempt count.  
**Mitigation (v1.0):** Documented limitation. For production with multiple workers, replace with Redis-backed counter.  
**Accepted:** Yes, for single-instance development and staging.

### 6.2 Downloaded Copies Cannot Be Recalled

**Risk:** Once a user downloads a document, the file exists on their device. Revoking permission prevents further downloads but cannot delete already-downloaded copies.  
**Impact:** An owner who grants then revokes access cannot guarantee the file is not retained by the viewer.  
**Mitigation:** Document owners are informed at grant time. Download events are logged with user identity. Legal or contractual controls apply outside the system.  
**Accepted:** Yes — this is an inherent limitation of file download, not a system flaw.

### 6.3 Audit Chain Cannot Detect Wholesale DB Replacement

**Risk:** If an attacker with full database write access replaces the entire `audit_events` table with a fabricated chain (correctly computing new hashes), the verification algorithm will not detect it.  
**Impact:** Post-incident audit history could be falsified if the attacker controls the database.  
**Mitigation:** Audit events should be forwarded to an append-only external SIEM or log aggregator in production. DB backups should be cryptographically signed. In-application chain verification detects partial tampering (modification, deletion of individual rows, reordering).  
**Accepted:** Partial. The hash chain provides strong resistance to partial tampering by insiders who do not control the full stack.

### 6.4 Archive / Zip Bomb

**Risk:** A malicious user could upload a compressed file (e.g., a zip bomb) that, when extracted by an internal tool, causes resource exhaustion.  
**Impact:** TrustVault does not extract uploaded files — files are stored as-is and served as-is — so this risk does not materialise in the current implementation.  
**Note:** If future versions add content scanning or automatic extraction, zip-bomb protections must be added.

### 6.5 Email Enumeration via Registration

**Risk:** A `409 Conflict` response on duplicate email registration reveals that the email is already registered.  
**Impact:** An attacker could enumerate which email addresses have accounts.  
**Mitigation (v1.0):** Registration returns `409` only on true duplicate, which is intentional to prevent confusing UX. All other responses return the same `PENDING_APPROVAL` message. Consider sending a "account already exists" email to the address silently and returning `200` for stricter enumeration resistance.  
**Accepted:** Yes, for v1.0.

### 6.6 No Multi-Factor Authentication for Non-Admin Users

**Risk:** Viewer and Owner accounts rely solely on password + CAPTCHA. A compromised password grants full account access.  
**Impact:** Account takeover is possible if passwords are reused from breached services.  
**Mitigation:** Strong password requirements enforced at registration. Argon2id slows offline cracking. MFA for administrators is planned. TOTP for all users is a v2 enhancement.  
**Accepted:** Yes, for v1.0.

### 6.7 SQLite in Development

**Risk:** SQLite does not enforce strict row-level locking. In high-concurrency scenarios, write collisions may cause errors.  
**Impact:** The production deployment uses PostgreSQL (configured via `DATABASE_URL`). SQLite is development/testing only.  
**Accepted:** Yes, for development. PostgreSQL required for production.

---

## 7. Security Testing Coverage

All tests in `backend/tests/` exercise security controls directly:

| Test file | Controls tested |
|---|---|
| `test_auth.py` | Unauthenticated access, CAPTCHA enforcement, role escalation block, generic errors, session invalidation |
| `test_admin_security.py` | Admin approval workflow, suspension → session revocation, admin content access block |
| `test_permissions.py` | Full grant/revoke lifecycle, viewer escalation blocked |
| `test_isolation_and_tampering.py` | Cross-tenant isolation, audit hash tamper detection, malicious MIME spoof |
| `test_security_controls.py` | Rate limiting (429), zero metadata leakage, rejected account block, expired reset token, audit gap detection |

Total: **22 tests passing** (verified by actual execution).

---

*This document was authored as part of the TrustVault development process and reflects the actual implemented controls in commit `17725b2`.*
