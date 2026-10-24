# TrustVault — Development Write-Up

> Author: TrustVault Development Team  
> Date: 2026-10-24  
> Version: 1.0

---

## 1. Overview

TrustVault was built from an empty repository in a single end-to-end development session. The goal was not to produce a prototype or a frontend demonstration, but a genuinely functional, security-first enterprise document-sharing platform with a real database, enforced backend controls, and automated security tests.

This write-up documents the major design decisions, problems encountered, solutions applied, and lessons learned.

---

## 2. Architecture Decisions

### 2.1 Why Server-Side Sessions Instead of Pure JWT

The problem statement requires immediate account suspension that invalidates active sessions. Pure JWT (stateless) cannot satisfy this: once issued, a JWT is valid until expiry regardless of account status changes.

We implemented a hybrid approach:
- A **server-side `sessions` table** stores `session_id`, `user_id`, `is_revoked`, `expires_at`
- The JWT contains only the `session_id` and is signed with `SECRET_KEY`
- Every protected request decodes the JWT, looks up the session in the database, and verifies `is_revoked == False` and `expires_at > now()`, then loads the user and checks `status == ACTIVE`

This means suspension takes effect on the **next request** without waiting for JWT expiry. The test `test_login_suspended_user_blocked` in `test_admin_security.py` verifies this end-to-end.

### 2.2 Why Argon2id

Argon2id is the winner of the 2015 Password Hashing Competition and the OWASP first recommendation for new applications. It is memory-hard (preventing GPU-based cracking), CPU-hard (preventing brute force), and resistant to both side-channel attacks (Argon2i property) and time-memory trade-off attacks (Argon2d property).

We use `time=3, memory=65536 KiB, parallelism=4` — above the OWASP minimum recommendations.

### 2.3 Why SHA-256 Hash-Chained Audit Logs

The problem statement requires "verifiable accountability" and "tamper-evident audit logs". A simple append-only table is insufficient: a database administrator could modify rows without detection.

A hash chain — where each event includes a hash of all previous events — makes it computationally infeasible to alter any past event without recomputing all subsequent hashes, which would cause a detectable chain break. The `/api/admin/audit/verify` endpoint recomputes and validates the entire chain on demand.

The limitation (an adversary who controls the entire database and can recompute the whole chain from scratch) is documented in THREATS.md and acknowledged as a residual risk requiring an external log sink for full mitigation.

### 2.4 Why UUID Storage Keys

Files are never stored under their original filename. A server-generated UUID4 is used as the storage key. This prevents:
- Path traversal (the UUID contains no `..` or `/`)
- Filename-based enumeration (cannot guess valid keys)
- Collision between same-named files from different tenants or owners

The original filename is stored in the `documents` table for display purposes only.

### 2.5 Why Admin Cannot Access Document Contents

The principle of separation of duties: administrators manage users and the platform; they do not automatically receive access to confidential content they were not explicitly granted.

This is enforced by role checks in the `GET /api/documents/{id}` and `GET /api/documents/{id}/download` endpoints that return `403` for admin roles, and is independently verified by `test_admin_cannot_download_document_content`.

---

## 3. Key Technical Challenges

### 3.1 Test Database Isolation

**Problem:** The initial test suite used a `scope="session"` database fixture, meaning the same SQLite database persisted across all test functions. Test contamination caused failures: a user created in test A was still present in test B, causing 409 conflicts or unexpected authentication states.

**Solution:** Changed to per-test database teardown. Each test function receives a fresh, empty database. All setup is done within the test itself using fixture functions that create the minimum required data.

### 3.2 Session Revocation Visibility Across SQLAlchemy Sessions

**Problem:** The suspension test would mark a session as revoked in the test fixture's DB session, then call the API through the TestClient, which opened a *separate* SQLAlchemy session. The revocation committed in the fixture session was not visible to the API session because they were different connection objects with different transaction scopes.

**Solution:** The test fixture commits its changes before making the API call. The `override_get_db` dependency in `conftest.py` creates a fresh session per request (matching production behaviour) rather than reusing the fixture session. This ensures the committed state is visible to subsequent requests.

### 3.3 Audit Timestamp Consistency

**Problem:** SQLite stores datetimes as naive (timezone-unaware) strings. The audit chain's canonical string formatting must produce identical output regardless of whether the timestamp was read as a naive datetime or a timezone-aware one.

**Solution:** Added `format_canonical_timestamp()` to `audit_chain.py` that always strips timezone info and formats as `%Y-%m-%dT%H:%M:%S.%f`. This ensures the hash computed at event creation time matches the hash recomputed at verification time.

### 3.4 Email Validator TLD Rejection

**Problem:** Test emails using `.local` TLDs (e.g., `admin@tenant.local`) were rejected by the `email-validator` library, which enforces RFC 5321 domain validation including TLD existence checks.

**Solution:** Changed all test email addresses to use `.com` TLDs. This is more representative of real-world usage and avoids a library-specific quirk.

### 3.5 Rate Limiter Test Contamination

**Problem:** The rate limiter uses an in-memory `defaultdict`. If a previous test triggered login failures, those failure counts persisted into the rate-limiting test, causing it to fail (the counter was already partly filled before the test began its loop).

**Solution:** Added `reset_rate_limits()` to `dependencies.py` and called it in the rate-limiting test's setup. The function clears the in-memory attempt counter for a specific email. This is only available in the test override; the production rate limiter is not resettable via the API.

---

## 4. Security Testing Philosophy

Every test in the test suite is a **security test**. We deliberately avoided testing happy paths that do not have security implications (e.g., "can you retrieve a document title?"). Instead, every test verifies that a specific security control works as intended:

- Can a PENDING user bypass approval? (No — verified)
- Can a viewer access an unshared document? (No — verified)  
- Can a viewer call owner endpoints? (No — verified)
- Can an admin read document contents? (No — verified)
- Can you exceed the rate limit? (Yes → 429 — verified)
- Does a fake magic-byte trick the upload? (No — verified)
- Is the audit hash detectable after row modification? (Yes — verified)
- Does cross-tenant isolation hold? (Yes — verified)

The 22 tests are not meant to cover every code path; they are meant to provide high assurance that the most critical security invariants cannot be broken by a realistic attacker.

---

## 5. Frontend Design Rationale

### 5.1 Colour Palette

The Midnight Indigo (#151B3D) / Electric Indigo (#635BDB) / Trust Teal (#13B8A6) combination was chosen to project authority, security, and trust — associations common in enterprise security branding. The palette avoids the generic blue associated with generic SaaS products while remaining readable and accessible.

### 5.2 Split-Screen Auth Layout

The authentication pages use a split-screen layout with a decorative security illustration on the left and the form on the right. This is a well-established enterprise security product pattern (Okta, Auth0, 1Password) that signals professionalism and allows rich branding without cluttering the form.

### 5.3 Role-Based Dashboard Routing

The `App.jsx` component dispatches to role-specific dashboards (`AdminDashboard`, `OwnerDashboard`, `ViewerDashboard`) based on the authenticated user's role from the server-verified `/api/auth/me` response. The role is never taken from `localStorage` or a URL parameter — it comes from the server on every app load.

### 5.4 Zero-Leakage Viewer Dashboard

The viewer dashboard makes a single call to `GET /api/documents/` with the authenticated session cookie. The backend returns only permission-filtered documents. The frontend displays exactly what the backend returns — no client-side filtering. This means there is no way to "inspect the network tab" and see document counts or titles for unshared documents because the API never sends them.

---

## 6. What Was Deliberately Not Built in v1.0

| Feature | Reason |
|---|---|
| TOTP/FIDO2 for all users | Significant UX complexity; planned for v2 |
| Real email delivery (SMTP) | Requires production email provider; dev mode uses notification table |
| Redis-backed rate limiting | Requires Redis; documented as single-process limitation |
| Document content scanning (AV) | Requires ClamAV or similar; storage architecture supports adding it |
| Full audit event streaming to SIEM | Requires external log sink; hash chain is a bridge solution |
| Multi-file upload | Not in problem statement; straightforward extension |
| Document versioning | Problem statement says "optional"; deferred to v2 |

---

## 7. Deployment Readiness

The application is deployment-ready for a single-instance production server:

1. Set all environment variables from `.env.example`
2. Point `DATABASE_URL` at a PostgreSQL instance
3. Set `CAPTCHA_PROVIDER=turnstile` and provide `CAPTCHA_SECRET_KEY`
4. Set `ENVIRONMENT=production` to enable HTTPS cookies and HSTS headers
5. Run `docker-compose up -d`
6. Run `alembic upgrade head` to apply migrations
7. Provision the first admin account via the seeding script or database insert

The Docker image serves the Vite-built frontend as static files from the same FastAPI process — no separate web server required for a single-instance deployment. For high-availability, place nginx or a load balancer in front and add Redis for rate limiting.

---

## 8. Conclusion

TrustVault demonstrates that security controls can be built correctly from the start without sacrificing a professional user experience. The key principles applied throughout:

1. **Backend enforces everything** — the frontend is a display layer, not a security layer
2. **Fail closed** — when in doubt, deny access and return 403 or 404
3. **Least privilege** — each role can only do what the problem statement explicitly authorises
4. **Immediate revocation** — permissions and sessions take effect instantly, not at next expiry
5. **Verifiable claims** — tests run and must pass; audit chain verifies and must detect tampering
6. **Documented limitations** — known residual risks are documented, not hidden

The 22 automated security tests provide a regression safety net ensuring that future feature additions do not accidentally break any of the security invariants established here.
