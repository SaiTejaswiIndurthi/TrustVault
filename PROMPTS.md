# TrustVault — AI-Assisted Development Log (PROMPTS.md)

> This file documents prompts given to the AI assistant during development, the AI's initial output, weaknesses identified through testing, and corrections applied.  
> All git commit hashes reference real commits in this repository.

---

## Entry 1 — 2026-10-24 — Initial Architecture and Model Design

### Prompt

> Design the database schema and SQLAlchemy models for a multi-tenant secure document-sharing platform. Include: tenants, users with role and status, server-side sessions, documents with private storage, document-level permissions with READ/EDIT types, password reset tokens, audit events, and notifications.

### AI Initial Output

The AI produced a comprehensive `models.py` with all requested tables. Key schema choices made in this pass:
- `User.role` as `Enum('ADMIN', 'DOCUMENT_OWNER', 'VIEWER')`
- `User.status` as `Enum('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED')`
- `Document.storage_key` as `UUID` — the AI correctly generated a server-side UUID rather than using the original filename
- `AuditEvent` included `previous_hash` and `event_hash` columns for hash chaining
- `DocumentPermission.is_active = True` on creation, `False` on revocation (soft revocation)

### Weakness Identified

The initial `AuditEvent` model used Python's `datetime.utcnow()` for timestamps. However, SQLite stores naive datetimes (no timezone information). When the hash chain verification later tried to format these timestamps for re-hashing, it produced different string representations depending on whether the value was loaded from the DB (naive) vs. created in code (potentially aware). This would cause spurious hash mismatches during audit chain verification.

### Correction Applied

Added `format_canonical_timestamp()` to `audit_chain.py`:

```python
def format_canonical_timestamp(dt: datetime) -> str:
    """Always produce a timezone-naive ISO8601 string for canonical hashing."""
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")
```

All hash computations now use this function, ensuring consistent output regardless of how the datetime was loaded.

**Commit:** `b086683` — `feat(backend): implement models, argon2id, audit hash-chain, security controls, and 22 pytest tests`

---

## Entry 2 — 2026-10-24 — Authentication Security

### Prompt

> Implement FastAPI authentication endpoints: register (with CAPTCHA server-side validation and PENDING_APPROVAL status), login (with Argon2id verification, generic error messages, HttpOnly cookie, and rate limiting), logout (session revocation), and password reset (cryptographic tokens, session invalidation on reset).

### AI Initial Output

The AI produced `routers/auth.py` with all requested endpoints. Notable security decisions:
- Login returns `"Invalid credentials"` for *both* wrong email and wrong password — no field-specific messages
- Password reset tokens are `secrets.token_urlsafe(32)` stored as `SHA-256(token)` in the database — the plaintext is never stored
- On password reset, all active sessions for the user are revoked by setting `is_revoked = True` on every `DbSession` row for that user
- CAPTCHA validation is server-side only via `captcha.py` — the frontend result is not trusted

### Weakness Identified

The initial implementation's rate limiter used `email` as the key without normalisation. An attacker could bypass the 5-attempt limit by sending `USER@example.com`, `user@EXAMPLE.COM`, `User@Example.Com` — all treated as different keys despite authenticating against the same account.

### Correction Applied

The rate limiter now normalises the key with `.lower().strip()` before incrementing:

```python
rate_key = email.lower().strip()
login_attempts[rate_key].append(now)
```

The same normalisation is applied in the attempt cleanup and check logic.

**Commit:** `b086683`

---

## Entry 3 — 2026-10-24 — Authorization Dependencies and Role Enforcement

### Prompt

> Implement FastAPI dependency functions for authentication: get_current_user (validates JWT, looks up server-side session, checks status==ACTIVE), require_admin, require_document_owner, require_viewer. Ensure the role is always loaded from the database, never from the JWT claim alone.

### AI Initial Output

The AI produced `dependencies.py` with the correct pattern: decode JWT → extract `session_id` → query `sessions` table → load `users` row → check role from DB. The JWT role claim is ignored for authorization decisions.

### Weakness Identified

The initial implementation did not check `session.expires_at > datetime.utcnow()`. An expired (but not explicitly revoked) session would still be accepted, allowing a user to remain authenticated indefinitely if session cleanup didn't run.

Additionally, when a user's status was changed to `SUSPENDED`, the code revoked their sessions, but the existing `get_current_user` dependency loaded the user from the DB and checked `user.status` — which is correct — but only *after* the session lookup. If someone held a valid JWT for a non-revoked session but their account was suspended *without* session revocation (e.g., a DB-level change), they could still authenticate.

### Correction Applied

1. Added expiry check: `if session.expires_at < datetime.utcnow(): raise 401`
2. The admin `PUT /admin/users/{id}/status` endpoint explicitly revokes all sessions on suspension (belt-and-suspenders alongside the status check)
3. Added `user.status == ACTIVE` as a mandatory check in `get_current_user` so even if a session isn't revoked, a suspended account is rejected

**Commit:** `b086683`

---

## Entry 4 — 2026-10-24 — Test Suite Design and Isolation

### Prompt

> Write a comprehensive pytest test suite with 22+ tests covering: unauthenticated access, CAPTCHA enforcement, role escalation prevention, account status blocking, admin content access separation, permission grant/revoke lifecycle, cross-tenant isolation, audit chain tamper detection, magic-byte spoofing prevention, login rate limiting, zero metadata leakage, expired token rejection, and audit gap detection.

### AI Initial Output

The AI produced 5 test files. Initial tests used a `scope="session"` fixture for the database, sharing one SQLite database across all test functions for performance.

### Weakness Identified — Test Contamination

Using `scope="session"` caused severe test contamination:

1. A user created in `test_registration_pending_approval` was still in the DB when `test_login_active_user_succeeds` ran, causing user lookup conflicts
2. Documents uploaded in `test_document_owner_upload_and_viewer_access_flow` persisted into `test_zero_metadata_leakage_for_viewers`, making the count assertions wrong
3. Rate limiter attempts from earlier tests accumulated into `test_login_rate_limiting_enforcement`, making it fail (rate limit hit before the test's own 6-attempt loop completed)

### Correction Applied

Changed to per-test cleanup:

```python
@pytest.fixture(autouse=True)
def clean_database(engine):
    """Drop and recreate all tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
```

Also added `reset_rate_limits(email)` call at the start of each test that tests rate limiting, to clear in-memory attempt history:

```python
def test_login_rate_limiting_enforcement(client, db_session):
    reset_rate_limits("ratelimit@example.com")
    # ... now safe to count from zero
```

**Commit:** `17725b2` — `feat(frontend): implement UI/UX, authentication flows, role dashboards, and static SPA serving`

> Note: This commit also contains the corrected test suite from the backend, as it was committed together with the frontend in the final consolidation push.

---

## Entry 5 — 2026-10-24 — Session Revocation Cross-Session Visibility

### Prompt

> The suspension test is failing: the test marks a user's session as revoked via the admin endpoint, then calls /api/auth/me with the victim's token, but the response still returns 200 instead of 401.

### AI Initial Diagnosis

The AI initially suggested the issue was that `DbSession.is_revoked` was not being committed. Code inspection showed the commit was present.

### Actual Root Cause

The `conftest.py` `override_get_db` generator was sharing the same SQLAlchemy session object between the test fixture and the API handler:

```python
# BROKEN: same session reused across fixture and request handler
def override_get_db():
    yield db_session  # db_session from fixture
```

When the admin endpoint committed the revocation in one request, the victim's subsequent request used a *different* SQLAlchemy session that had already loaded (and cached) the session record before the commit. SQLAlchemy's identity map served the stale cached object.

### Correction Applied

Changed `override_get_db` to create a **fresh session per request**, matching production behaviour:

```python
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
```

This ensures each request reads from the database, seeing all committed changes from previous requests.

**Commit:** `17725b2`

---

## Entry 6 — 2026-10-24 — Email Validator TLD Rejection

### Prompt

> Tests are failing with a 422 Unprocessable Entity on registration. The registration endpoint receives valid-looking emails like admin@tenant1.local but rejects them.

### AI Initial Output

The AI suggested adding `check_deliverability=False` to the `EmailStr` validator configuration to bypass MX record checks.

### Actual Root Cause

The `email-validator` library (required by Pydantic's `EmailStr`) enforces RFC 5321 compliance including basic TLD structure. `.local` is a special-use TLD reserved for mDNS/Zeroconf and is explicitly rejected by the library — `check_deliverability=False` does not bypass TLD validation, only DNS MX checks.

### Correction Applied

Changed all test email addresses to use `.com` TLDs:

```python
# Before (broken)
"email": "admin@tenant1.local"

# After (working)
"email": "admin@tenant1example.com"
```

This is correct test practice: test data should be representative of real usage. Domain suffixes like `.local` are not valid public email domains and should not appear in test data that validates email addresses.

**Commit:** `17725b2`

---

## Entry 7 — 2026-10-24 — Admin Document Access Separation of Duties

### Prompt

> The problem statement requires that administrators must not automatically access confidential document contents. Implement and test this separation of duties.

### AI Initial Output

The AI added a role check to the document download endpoint but initially placed it *after* the permission check, meaning an admin who also happened to have a permission grant could download.

### Weakness Identified

The check order was:

```python
# WRONG: permission check first, role check second
permission = check_document_permission(...)
if current_user.role == "ADMIN":
    raise 403
```

An admin granted a `DOCUMENT_PERMISSION` record (e.g., by directly inserting a DB row) would pass the permission check and never reach the role check.

### Correction Applied

Role check moved to **first**, before any permission lookup:

```python
# CORRECT: role check is absolute and unconditional
if current_user.role == UserRole.ADMIN:
    raise HTTPException(status_code=403, detail="Administrators cannot access document contents")

# Permission check only reached by non-admins
```

The test `test_admin_cannot_download_document_content` verifies this explicitly.

**Commit:** `b086683`

---

## Summary of Corrections

| Entry | Issue | Category | Commit |
|---|---|---|---|
| 1 | Timestamp timezone inconsistency in audit hash chain | Bug | `b086683` |
| 2 | Rate limiter email not normalised (case bypass) | Security | `b086683` |
| 3 | Session expiry not checked; status not checked post-revoke | Security | `b086683` |
| 4 | Test contamination from shared `scope="session"` DB | Test quality | `17725b2` |
| 5 | Session revocation invisible to separate SQLAlchemy session | Bug | `17725b2` |
| 6 | `.local` TLD rejection by email-validator in test data | Test quality | `17725b2` |
| 7 | Admin role check placed after permission check | Security | `b086683` |
