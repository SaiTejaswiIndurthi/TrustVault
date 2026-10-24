# TrustVault

**Secure Sharing. Smarter Access. Verifiable Accountability.**

TrustVault is a fully functional, enterprise-grade, multi-tenant document-sharing platform with cryptographic audit logging, zero-trust permission enforcement, and verifiable tamper detection.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18 + Vite 5, plain CSS design system (no Tailwind dependency) |
| Backend | Python 3.13, FastAPI 0.162, Uvicorn |
| ORM | SQLAlchemy 2 |
| Database | SQLite (dev) / PostgreSQL (prod-ready via `DATABASE_URL`) |
| Passwords | Argon2id via argon2-cffi |
| Sessions | Server-side DB sessions + signed JWTs in HttpOnly cookies |
| Audit | SHA-256 hash-chained append-only audit event table |
| Storage | Private local vault (`backend/storage/vault/`) — UUID storage keys |
| Testing | Pytest 9 — 22 security test cases (all passing) |
| Deployment | Docker + docker-compose |

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Backend
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Seed database with demo users, documents, and permissions
python backend/seed.py

# Start the API server
uvicorn backend.app.main:app --reload --port 8000
```

### 2. Frontend (Development HMR)
```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

The Vite dev server proxies all `/api` requests to `http://localhost:8000`.

### 3. Production Build (SPA served by FastAPI)
```bash
cd frontend
npm run build

# Then just run the backend — it will serve the built SPA
uvicorn backend.app.main:app --port 8000
```

Open: **http://localhost:8000**

### 4. Docker
```bash
cd frontend && npm run build && cd ..
docker compose up --build
```

API + SPA available at: **http://localhost:8000**

---

## Demo Credentials

> ⚠️ **Development only.** Change all credentials before any production deployment.

| Role | Email | Password |
| :--- | :--- | :--- |
| Administrator | `admin@trustvault.local` | `AdminPassword123!` |
| Document Owner | `owner@trustvault.local` | `OwnerPassword123!` |
| Active Viewer | `viewer@trustvault.local` | `ViewerPassword123!` |
| Pending Approval | `pending@trustvault.local` | `PendingPassword123!` |

---

## Security Architecture

- **Argon2id** password hashing (time=3, memory=64MiB, parallelism=4)
- **Server-side sessions** in database with HttpOnly cookies, `SameSite=Lax`
- **CAPTCHA** — Cloudflare Turnstile / Google reCAPTCHA — server-side validated; dev mode transparent banner
- **PENDING_APPROVAL** workflow — accounts cannot log in until an Admin approves them
- **Separation of duties** — Administrators cannot download or read confidential document content
- **Document-level permissions** — READ/EDIT per document per user, immediately revocable
- **SHA-256 hash-chained audit log** — any modification, deletion, or reordering is cryptographically detectable
- **Magic-byte file signature validation** — prevents MIME spoofing during uploads
- **Path traversal prevention** — all storage keys validated to stay inside private vault directory
- **Multi-tenant isolation** — users from Tenant A cannot query, discover, or access Tenant B data
- **Rate limiting** — 5 failed login attempts per 5-minute window triggers 429
- **Generic auth errors** — prevents user enumeration
- **Security headers** — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS in production
- **Session invalidation** — on suspension, rejection, password reset, and explicit logout

---

## Running Tests

```bash
# Run full security test suite (22 tests)
pytest -v backend/tests

# Expected output:
# 22 passed, 6 warnings in ~22s
```

Tests cover: unauthenticated access, CAPTCHA bypass, role escalation, pending/suspended account blocking, admin content-access prohibition, immediate permission revocation, cross-tenant isolation, audit hash tampering detection, audit event deletion detection, malicious file upload spoofing, rate limiting enforcement, zero metadata leakage, expired password reset tokens.

---

## API Documentation

Start the server and navigate to:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

Full documentation: [`docs/API.md`](docs/API.md)

---

## Environment Variables

See [`.env.example`](.env.example) for all configuration options.

Critical production variables:
- `SECRET_KEY` — JWT signing key (min 64 chars, random)
- `CSRF_SECRET` — CSRF token key
- `DATABASE_URL` — PostgreSQL connection string
- `CAPTCHA_PROVIDER` + `CAPTCHA_SECRET_KEY` — Turnstile or reCAPTCHA
- `ENVIRONMENT=production` — enables HTTPS cookies and HSTS

---

## Project Structure

```
TrustVault/
├── backend/
│   ├── app/
│   │   ├── config.py            # Settings via pydantic-settings
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # All database models (Tenant, User, Document, Permission, AuditEvent, ...)
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── dependencies.py      # Auth middleware, rate limiting, role guards
│   │   ├── main.py              # FastAPI app + SPA mounting
│   │   ├── routers/
│   │   │   ├── auth.py          # Registration, login, logout, password reset
│   │   │   ├── admin.py         # User management, audit logs, verification
│   │   │   ├── documents.py     # Upload, stream, metadata, delete
│   │   │   └── permissions.py   # Grant/revoke, activity, active-users
│   │   ├── security/
│   │   │   ├── passwords.py     # Argon2id hashing and verification
│   │   │   ├── tokens.py        # JWT creation/decoding, secure token generation
│   │   │   ├── captcha.py       # Turnstile/reCAPTCHA server-side verification
│   │   │   └── audit_chain.py   # SHA-256 hash-chained audit log engine
│   │   └── storage/
│   │       └── local_storage.py # Private vault storage, magic-byte validation
│   ├── tests/                   # 22 Pytest security tests
│   ├── seed.py                  # Development seed script (4 demo users, 2 documents)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root router: auth pages vs role dashboards
│   │   ├── context/AuthContext.jsx
│   │   ├── services/api.js      # Typed API client (Bearer + HttpOnly cookie)
│   │   ├── components/          # Logo, Navbar, Modal, CaptchaWidget
│   │   └── pages/               # Login, Register, ForgotPassword, 3 role dashboards
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/
│   ├── REQUIREMENTS.md          # Original full problem statement
│   ├── API.md                   # Complete REST API reference
│   ├── ARCHITECTURE.md          # System design and data flow diagrams
│   └── WRITEUP.md               # Development narrative
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── pytest.ini
├── README.md
├── THREATS.md
└── PROMPTS.md
```

---

## Documentation

| Document | Purpose |
| :--- | :--- |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Original problem statement — source of truth |
| [`docs/API.md`](docs/API.md) | REST API reference |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture |
| [`docs/WRITEUP.md`](docs/WRITEUP.md) | Development writeup |
| [`THREATS.md`](THREATS.md) | Threat model and residual risks |
| [`PROMPTS.md`](PROMPTS.md) | AI-assisted development log |
