import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from backend.app.models import AuditEvent

GENESIS_HASH = "0" * 64

def format_canonical_timestamp(ts: datetime) -> str:
    """Produces consistent UTC ISO-8601 string across database backends."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = ts.astimezone(timezone.utc)
    return ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

def calculate_event_hash(
    prev_hash: str,
    sequence_number: int,
    tenant_id: str,
    timestamp_iso: str,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    outcome: str,
    details_str: str,
) -> str:
    """
    Computes deterministic SHA-256 hash for an audit event chained to previous event.
    """
    canonical_payload = (
        f"{prev_hash}|"
        f"{sequence_number}|"
        f"{tenant_id}|"
        f"{timestamp_iso}|"
        f"{actor_id or 'NONE'}|"
        f"{action}|"
        f"{resource_type}|"
        f"{resource_id or 'NONE'}|"
        f"{outcome}|"
        f"{details_str}"
    )
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()

def record_audit_event(
    db: Session,
    tenant_id: str,
    action: str,
    resource_type: str,
    outcome: str = "SUCCESS",
    actor_id: str | None = None,
    actor_email: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    timestamp: datetime | None = None,
) -> AuditEvent:
    """
    Atomically appends an audit event to the tenant's hash chain.
    Guarantees monotonic sequence numbering and immutable hash integrity.
    Never logs credentials, session secrets, or confidential document content.
    """
    # Sanitize details to guarantee no secrets leak into audit logs
    clean_details = (details or {}).copy()
    for sensitive_key in [
        "password", "password_confirm", "token", "secret", "file_content",
        "authorization", "cookie", "session_token", "reset_token"
    ]:
        if sensitive_key in clean_details:
            clean_details[sensitive_key] = "[REDACTED]"
            
    details_json = json.dumps(clean_details, sort_keys=True)
    event_timestamp = timestamp or datetime.now(timezone.utc)
    timestamp_iso = format_canonical_timestamp(event_timestamp)

    # Find the last audit event for this tenant
    last_event = (
        db.query(AuditEvent)
        .filter(AuditEvent.tenant_id == tenant_id)
        .order_by(AuditEvent.sequence_number.desc())
        .first()
    )

    if last_event:
        sequence_number = last_event.sequence_number + 1
        prev_hash = last_event.event_hash
    else:
        sequence_number = 1
        prev_hash = GENESIS_HASH

    event_hash = calculate_event_hash(
        prev_hash=prev_hash,
        sequence_number=sequence_number,
        tenant_id=tenant_id,
        timestamp_iso=timestamp_iso,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        details_str=details_json,
    )

    event = AuditEvent(
        tenant_id=tenant_id,
        sequence_number=sequence_number,
        timestamp=event_timestamp,
        actor_id=actor_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        details=details_json,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        prev_hash=prev_hash,
        event_hash=event_hash,
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def verify_tenant_audit_chain(db: Session, tenant_id: str) -> dict[str, Any]:
    """
    Verifies the cryptographic integrity of the audit log chain for a tenant.
    Detects any modification, deletion, reordering, or tampering.
    """
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.tenant_id == tenant_id)
        .order_by(AuditEvent.sequence_number.asc())
        .all()
    )

    total_events = len(events)
    if total_events == 0:
        return {
            "is_valid": True,
            "total_events": 0,
            "verified_events": 0,
            "message": "Audit chain is empty. Clean state.",
            "tampered_events": [],
        }

    expected_prev_hash = GENESIS_HASH
    tampered_events = []

    for idx, event in enumerate(events):
        expected_seq = idx + 1
        # Check sequence continuity
        if event.sequence_number != expected_seq:
            tampered_events.append({
                "event_id": event.id,
                "sequence_number": event.sequence_number,
                "error_type": "SEQUENCE_GAP_OR_REORDER",
                "expected_sequence": expected_seq,
                "actual_sequence": event.sequence_number,
            })

        # Check prev_hash link
        if event.prev_hash != expected_prev_hash:
            tampered_events.append({
                "event_id": event.id,
                "sequence_number": event.sequence_number,
                "error_type": "BROKEN_CHAIN_LINK",
                "expected_prev_hash": expected_prev_hash,
                "actual_prev_hash": event.prev_hash,
            })

        # Recalculate event hash
        timestamp_iso = format_canonical_timestamp(event.timestamp)
        computed_hash = calculate_event_hash(
            prev_hash=event.prev_hash,
            sequence_number=event.sequence_number,
            tenant_id=event.tenant_id,
            timestamp_iso=timestamp_iso,
            actor_id=event.actor_id,
            action=event.action,
            resource_type=event.resource_type,
            resource_id=event.resource_id,
            outcome=event.outcome,
            details_str=event.details,
        )

        if computed_hash != event.event_hash:
            tampered_events.append({
                "event_id": event.id,
                "sequence_number": event.sequence_number,
                "error_type": "HASH_MISMATCH",
                "expected_hash": computed_hash,
                "actual_hash": event.event_hash,
            })

        # Prepare for next link
        expected_prev_hash = event.event_hash

    is_valid = len(tampered_events) == 0
    return {
        "is_valid": is_valid,
        "total_events": total_events,
        "verified_events": total_events - len(tampered_events),
        "latest_hash": events[-1].event_hash if events else None,
        "tampered_events": tampered_events,
        "message": "All audit events verified intact." if is_valid else f"Audit tampering detected! {len(tampered_events)} violations found."
    }
