import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.config import settings
from backend.app.database import Base, get_db
from backend.app.dependencies import reset_rate_limits
from backend.app.main import app
from backend.app.models import Document, DocumentPermission, Tenant, User
from backend.app.security.passwords import hash_password
from backend.app.storage.local_storage import save_document_bytes

TEST_DB_FILE = "trustvault_test.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def clean_environment():
    reset_rate_limits()
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    reset_rate_limits()

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    yield session
    session.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def seeded_tenant(db_session):
    tenant = Tenant(name="CyberDyne Systems", slug="cyberdyne")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant

@pytest.fixture
def other_tenant(db_session):
    tenant = Tenant(name="Omni Consumer Products", slug="ocp")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant

@pytest.fixture
def admin_user(db_session, seeded_tenant):
    user = User(
        tenant_id=seeded_tenant.id,
        email="admin_test@trustvault.com",
        full_name="Admin Security Officer",
        phone_number="+1-555-010-0001",
        password_hash=hash_password("SuperSecretAdminPass123!"),
        role="ADMIN",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def owner_user(db_session, seeded_tenant):
    user = User(
        tenant_id=seeded_tenant.id,
        email="owner_test@trustvault.com",
        full_name="Alice Document Owner",
        phone_number="+1-555-010-0002",
        password_hash=hash_password("SuperSecretOwnerPass123!"),
        role="DOCUMENT_OWNER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def viewer_user(db_session, seeded_tenant):
    user = User(
        tenant_id=seeded_tenant.id,
        email="viewer_test@trustvault.com",
        full_name="Bob Viewer",
        phone_number="+1-555-010-0003",
        password_hash=hash_password("SuperSecretViewerPass123!"),
        role="VIEWER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def pending_user(db_session, seeded_tenant):
    user = User(
        tenant_id=seeded_tenant.id,
        email="pending_test@trustvault.com",
        full_name="Charlie Pending",
        phone_number="+1-555-010-0004",
        password_hash=hash_password("SuperSecretPendingPass123!"),
        role="VIEWER",
        status="PENDING_APPROVAL",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def suspended_user(db_session, seeded_tenant):
    user = User(
        tenant_id=seeded_tenant.id,
        email="suspended_test@trustvault.com",
        full_name="Dave Suspended",
        phone_number="+1-555-010-0005",
        password_hash=hash_password("SuperSecretSuspendedPass123!"),
        role="VIEWER",
        status="SUSPENDED",
        suspension_reason="Policy violation.",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def other_tenant_user(db_session, other_tenant):
    user = User(
        tenant_id=other_tenant.id,
        email="outsider@ocp.com",
        full_name="Eve Outsider",
        phone_number="+1-555-099-9999",
        password_hash=hash_password("OutsiderPass123!"),
        role="VIEWER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def sample_pdf_document(db_session, seeded_tenant, owner_user):
    content = b"%PDF-1.4 Confidential test document content\nRestricted access."
    key, clean_fn, size, sha256 = save_document_bytes(content, "confidential_test.pdf", "application/pdf")
    doc = Document(
        tenant_id=seeded_tenant.id,
        owner_id=owner_user.id,
        title="Test Confidential Report",
        description="Top secret internal analysis",
        category="Security",
        storage_key=key,
        original_filename=clean_fn,
        file_size=size,
        mime_type="application/pdf",
        file_hash_sha256=sha256,
        is_archived=False,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc
