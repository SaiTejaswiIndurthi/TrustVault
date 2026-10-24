import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database import SessionLocal, Base, engine
from backend.app.models import Tenant, User, Document, DocumentPermission
from backend.app.security.passwords import hash_password
from backend.app.security.audit_chain import record_audit_event
from backend.app.storage.local_storage import save_document_bytes

def seed_database():
    print("Initializing TrustVault Database schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Create Default Tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "cybercorp").first()
        if not tenant:
            tenant = Tenant(
                name="CyberCorp Financial & Defense",
                slug="cybercorp",
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"Created Tenant: {tenant.name} (id={tenant.id})")

        # 2. Seed Administrator (Trusted provisioning - cannot self-register)
        admin = db.query(User).filter(User.email == "admin@trustvault.local").first()
        if not admin:
            admin = User(
                tenant_id=tenant.id,
                email="admin@trustvault.local",
                full_name="Sarah Connor (System Administrator)",
                phone_number="+1-555-019-2831",
                password_hash=hash_password("AdminPassword123!"),
                role="ADMIN",
                status="ACTIVE",
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="SYSTEM_INIT_ADMIN",
                resource_type="USER",
                resource_id=admin.id,
                outcome="SUCCESS",
                actor_id=admin.id,
                actor_email=admin.email,
                details={"role": "ADMIN", "mode": "trusted_provisioning"},
            )
            print(f"Seeded Admin: {admin.email}")

        # 3. Seed Document Owner
        owner = db.query(User).filter(User.email == "owner@trustvault.local").first()
        if not owner:
            owner = User(
                tenant_id=tenant.id,
                email="owner@trustvault.local",
                full_name="Dr. Evelyn Reed (Chief Risk Officer)",
                phone_number="+1-555-014-9920",
                password_hash=hash_password("OwnerPassword123!"),
                role="DOCUMENT_OWNER",
                status="ACTIVE",
                approved_by_id=admin.id,
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="USER_ACTIVE",
                resource_type="USER",
                resource_id=owner.id,
                outcome="SUCCESS",
                actor_id=admin.id,
                actor_email=admin.email,
                details={"role": "DOCUMENT_OWNER", "approved_by": admin.email},
            )
            print(f"Seeded Owner: {owner.email}")

        # 4. Seed Active Viewer
        viewer = db.query(User).filter(User.email == "viewer@trustvault.local").first()
        if not viewer:
            viewer = User(
                tenant_id=tenant.id,
                email="viewer@trustvault.local",
                full_name="Marcus Vance (Security Auditor)",
                phone_number="+1-555-018-4411",
                password_hash=hash_password("ViewerPassword123!"),
                role="VIEWER",
                status="ACTIVE",
                approved_by_id=admin.id,
            )
            db.add(viewer)
            db.commit()
            db.refresh(viewer)
            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="USER_ACTIVE",
                resource_type="USER",
                resource_id=viewer.id,
                outcome="SUCCESS",
                actor_id=admin.id,
                actor_email=admin.email,
                details={"role": "VIEWER", "approved_by": admin.email},
            )
            print(f"Seeded Viewer: {viewer.email}")

        # 5. Seed Pending Approval User
        pending = db.query(User).filter(User.email == "pending@trustvault.local").first()
        if not pending:
            pending = User(
                tenant_id=tenant.id,
                email="pending@trustvault.local",
                full_name="Alex Chen (Contractor)",
                phone_number="+1-555-017-8899",
                password_hash=hash_password("PendingPassword123!"),
                role="VIEWER",
                status="PENDING_APPROVAL",
            )
            db.add(pending)
            db.commit()
            db.refresh(pending)
            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="AUTH_REGISTER",
                resource_type="USER",
                resource_id=pending.id,
                outcome="SUCCESS",
                actor_id=pending.id,
                actor_email=pending.email,
                details={"role": "VIEWER", "status": "PENDING_APPROVAL"},
            )
            print(f"Seeded Pending User: {pending.email}")

        # 6. Seed Sample Confidential Documents
        doc_count = db.query(Document).filter(Document.tenant_id == tenant.id).count()
        if doc_count == 0:
            sample_content_1 = b"%PDF-1.5 Confidential Q3 Financial Risk Matrix & Liquidity Assessment...\nCyberCorp Internal Eyes Only."
            key1, clean_fn1, size1, hash1 = save_document_bytes(sample_content_1, "Q3_Risk_Assessment.pdf", "application/pdf")
            
            doc1 = Document(
                tenant_id=tenant.id,
                owner_id=owner.id,
                title="Q3 Enterprise Financial Risk Assessment",
                description="Comprehensive liquidity risk analysis, capital reserves, and stress test scenarios for Q3.",
                category="Finance",
                storage_key=key1,
                original_filename=clean_fn1,
                file_size=size1,
                mime_type="application/pdf",
                file_hash_sha256=hash1,
                is_archived=False,
            )
            db.add(doc1)
            db.commit()
            db.refresh(doc1)

            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="DOC_UPLOAD",
                resource_type="DOCUMENT",
                resource_id=doc1.id,
                outcome="SUCCESS",
                actor_id=owner.id,
                actor_email=owner.email,
                details={"title": doc1.title, "filename": doc1.original_filename, "sha256": hash1},
            )

            # Grant READ permission to viewer
            perm1 = DocumentPermission(
                document_id=doc1.id,
                user_id=viewer.id,
                permission_level="READ",
                granted_by_id=owner.id,
                is_active=True,
            )
            db.add(perm1)
            db.commit()
            db.refresh(perm1)

            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="PERMISSION_GRANT",
                resource_type="DOCUMENT_PERMISSION",
                resource_id=perm1.id,
                outcome="SUCCESS",
                actor_id=owner.id,
                actor_email=owner.email,
                details={
                    "document_id": doc1.id,
                    "target_user_id": viewer.id,
                    "target_user_email": viewer.email,
                    "permission_level": "READ",
                },
            )
            print(f"Seeded Document: {doc1.title} with active permission for {viewer.email}")

            # Second document (Unshared confidential document)
            sample_content_2 = b"%PDF-1.4 Vault Key Management & Cryptographic Zero-Trust Blueprint...\nProprietary and Confidential."
            key2, clean_fn2, size2, hash2 = save_document_bytes(sample_content_2, "Cryptographic_Blueprint.pdf", "application/pdf")

            doc2 = Document(
                tenant_id=tenant.id,
                owner_id=owner.id,
                title="Zero-Trust Cryptographic Key Hierarchy",
                description="Hardware security module (HSM) architecture and key rotation policies.",
                category="Engineering",
                storage_key=key2,
                original_filename=clean_fn2,
                file_size=size2,
                mime_type="application/pdf",
                file_hash_sha256=hash2,
                is_archived=False,
            )
            db.add(doc2)
            db.commit()
            db.refresh(doc2)

            record_audit_event(
                db=db,
                tenant_id=tenant.id,
                action="DOC_UPLOAD",
                resource_type="DOCUMENT",
                resource_id=doc2.id,
                outcome="SUCCESS",
                actor_id=owner.id,
                actor_email=owner.email,
                details={"title": doc2.title, "filename": doc2.original_filename, "sha256": hash2},
            )
            print(f"Seeded Confidential Unshared Document: {doc2.title}")

        print("\n=== TrustVault Seed Completed Successfully! ===")
        print("Demo Credentials:")
        print("  Administrator:  admin@trustvault.local  / AdminPassword123!")
        print("  Document Owner: owner@trustvault.local  / OwnerPassword123!")
        print("  Active Viewer:  viewer@trustvault.local / ViewerPassword123!")
        print("  Pending User:   pending@trustvault.local/ PendingPassword123!")
        print("===============================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
