# TrustVault — Requirements & Specification

## 1. Executive Summary & Objective

**TrustVault** is an enterprise-grade, multi-tenant document-sharing and verifiable accountability platform. It enables organizations to securely upload, share, manage, and protect confidential documents through strict, cryptographically verified access controls and tamper-evident audit trails.

### Core Pillars
1. **Secure Sharing**: Zero unauthorized access; documents are stored with random UUID keys in private storage outside the web root. Files are never directly accessible via public URLs; access is mediated through authenticated, authorized streaming endpoints.
2. **Smarter Access**: Fine-grained, document-level permissions (READ, EDIT) with immediate server-side revocation enforcement and strict role-based constraints.
3. **Verifiable Accountability**: Comprehensive, append-only, SHA-256 hash-chained audit logging capturing all security events, permission modifications, and data access, paired with cryptographic verification endpoints.
4. **Tenant Isolation**: Multi-tenant isolation ensuring users from one organization cannot discover, query, or access another organization's documents, accounts, permissions, or audit logs.

---

## 2. User Roles and Access Control Matrix

| Capability / Action | Administrator | Document Owner | Viewer | Unauthenticated / Pending |
| :--- | :---: | :---: | :---: | :---: |
| **Self-Registration (with CAPTCHA)** | No (Trusted invite/provisioning only) | Yes (Requires Approval) | Yes (Requires Approval) | Yes |
| **Log In to Application** | Yes (if ACTIVE) | Yes (if ACTIVE) | Yes (if ACTIVE) | No |
| **Approve / Reject / Suspend Users** | Yes | No | No | No |
| **View System Audit Logs & Verify Hash Chain** | Yes | No | No | No |
| **View Security Analytics & Active Sessions** | Yes | No | No | No |
| **Upload Confidential Documents** | No (Enforces separation of duties) | Yes | No | No |
| **Read / Download Confidential Content** | **NO** (Strictly forbidden to prevent administrative overreach) | Yes (Own documents) | Yes (Only if granted active READ/EDIT) | No |
| **Grant / Revoke Document Permissions** | No | Yes (Own documents) | No | No |
| **Edit Document Metadata** | No | Yes (Own documents) | No (unless granted EDIT) | No |
| **Delete / Archive Documents** | No | Yes (Own documents) | No | No |
| **View Document-Specific Audit History** | Yes (Metadata level) | Yes (Own documents) | No | No |
| **Search & Discover Documents** | Metadata only | Own & Shared | Only Explicitly Granted | No |

---

## 3. Detailed Functional Requirements

### 3.1 Authentication & Registration
- **Registration Form**: Collects full name, email, international phone number with country code, password, password confirmation, organization ID/name, and target role (Document Owner or Viewer; Administrator accounts cannot be self-registered).
- **CAPTCHA**: Integrated with Cloudflare Turnstile / Google reCAPTCHA. Server-side token verification enforces strict rejection of invalid, expired, or reused tokens. In development mode without provider keys, a designated local test token is supported with transparent UI banners.
- **Account Approval Workflow**:
  - Initial state: `PENDING_APPROVAL`.
  - Authorized Administrators review pending accounts and issue `ACTIVE` or `REJECTED` status.
  - Administrators can `SUSPEND` active accounts at any time, immediately invalidating active sessions.
  - Notifications are generated and dispatched upon status transitions.

### 3.2 Secure Sessions & Credential Management
- **Password Security**: Argon2id hashing with recommended memory, time, and parallelism parameters.
- **Session Architecture**: Server-side session tracking stored in the database.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` flags, CSRF tokens embedded in double-submit or header-verified cookies.
- **Session Rotation & Invalidation**: Rotation upon login and privilege elevation; immediate invalidation across all devices upon account suspension, password reset, or explicit logout.

### 3.3 Private Document Storage & Management
- **Storage Protection**: Files stored in private storage (`storage/vault/` or S3 bucket) using random server-generated UUID identifiers; no raw filenames or predictable paths on disk.
- **Validation Controls**: Strict file size limits (e.g., 25MB max), whitelist of allowed MIME types and file extensions (PDF, DOCX, XLSX, PNG, JPEG, TXT), magic-byte file signature validation to prevent file spoofing, sanitization of metadata to prevent XSS and path traversal.
- **Secure Retrieval**: Content-Disposition header with safe sanitized filename; authenticated streaming with permission checks evaluated on every byte stream request.

### 3.4 Document-Level Permissions & Immediate Revocation
- **Granular Permissions**:
  - `READ`: View document metadata and download the decrypted/streamed file.
  - `EDIT`: Read, download, and update permitted metadata.
- **Permission Lifecycle**: Records `document_id`, `user_id`, `permission_level`, `granted_by`, `granted_at`, `revoked_by`, `revoked_at`, and `is_active`.
- **Immediate Revocation**: Any revocation by the owner immediately marks `is_active = False` and `revoked_at = NOW()`. Subsequent attempts to view or download by the revoked user receive `403 Forbidden` within the exact same transaction cycle.

### 3.5 Tamper-Evident Hash-Chained Audit Logging
- **Append-Only Event Store**: Every security-sensitive action writes an audit record with `id`, `sequence_number`, `tenant_id`, `actor_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent`, `status`, `details`, `timestamp`, `prev_hash`, and `event_hash`.
- **Cryptographic Chaining**:
  $$H_i = \text{SHA256}(H_{i-1} \parallel \text{seq} \parallel \text{timestamp} \parallel \text{tenant\_id} \parallel \text{actor} \parallel \text{action} \parallel \text{resource} \parallel \text{status} \parallel \text{details})$$
- **Verification Engine**: Verification endpoint iterates through the audit sequence, recalculates each hash from the chained predecessor, and flags any modification, deletion, reordering, or hash break.
- **Separation of Sensitive Data**: Passwords, session tokens, reset tokens, and raw document contents are never logged.

### 3.6 Role-Specific Dashboards (UI/UX)
- Designed with TrustVault brand palette:
  - Midnight Indigo: `#151B3D`
  - Electric Indigo: `#635BDB`
  - Trust Teal: `#13B8A6`
  - Soft Lavender: `#EEEAFE`
  - Cloud White: `#F5F7FC`
  - Amber Warning: `#F59E0B`
  - Restrained Crimson: `#EF4444`
- Custom SVG Shield-and-Lock brand mark.
- **Admin Dashboard**: Metrics (total users, active sessions, pending approvals, total documents), user management table, approval/rejection actions, audit log explorer with hash verification runner, security event analytics.
- **Owner Dashboard**: Document inventory, drag-and-drop upload modal with signature verification, document detail modal, permission modal to grant/revoke access to active users with live feedback, document audit timeline.
- **Viewer Dashboard**: Accessible documents list, quick search/filters, secure viewer/downloader, zero leakage of unshared document metadata.

---

## 4. Acceptance Criteria Checklist

- [x] Strict Multi-Tenant Isolation
- [x] Argon2id Password Hashing
- [x] Account Approval Workflow (`PENDING_APPROVAL` $\rightarrow$ `ACTIVE`/`REJECTED`/`SUSPENDED`)
- [x] Server-Enforced CAPTCHA Verification with dev fallback indicators
- [x] Document-Level Permissions (`READ`, `EDIT`)
- [x] Immediate Permission Revocation
- [x] Separation of Administrative Duties (Admins cannot read document contents)
- [x] Tamper-Evident SHA-256 Hash Chaining with Verification Engine
- [x] Comprehensive Automated Pytest Suite (>25 test cases covering security edges)
- [x] Three Role-Specific Dashboards with Midnight Indigo & Trust Teal Palette
- [x] Dockerization & Production Readiness
- [x] Full Documentation Suite (`README.md`, `THREATS.md`, `PROMPTS.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/WRITEUP.md`)
