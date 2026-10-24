from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.dependencies import (
    get_client_ip,
    get_current_user,
    get_user_agent,
    require_document_owner,
)
from backend.app.models import (
    Document,
    DocumentPermission,
    User,
)
from backend.app.schemas import (
    DocumentResponse,
    DocumentUpdateMetadataRequest,
    OwnerDashboardStats,
    ViewerDashboardStats,
)
from backend.app.security.audit_chain import record_audit_event
from backend.app.storage.local_storage import (
    delete_document_file,
    read_document_stream,
    save_document_bytes,
)

router = APIRouter(prefix="/api/documents", tags=["Document Management"])

@router.get("/owner/stats", response_model=OwnerDashboardStats)
def get_owner_stats(
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """Metrics for Document Owner dashboard."""
    owned_docs = db.query(Document).filter(
        Document.tenant_id == owner.tenant_id,
        Document.owner_id == owner.id,
        Document.is_archived == False,
    ).all()

    total_owned = len(owned_docs)
    owned_ids = [d.id for d in owned_docs]

    # Shared documents count
    shared_count = (
        db.query(DocumentPermission.document_id)
        .filter(DocumentPermission.document_id.in_(owned_ids), DocumentPermission.is_active == True)
        .distinct()
        .count()
    ) if owned_ids else 0

    # Active permission grants
    active_grants = (
        db.query(DocumentPermission)
        .filter(DocumentPermission.document_id.in_(owned_ids), DocumentPermission.is_active == True)
        .count()
    ) if owned_ids else 0

    categories = list({d.category for d in owned_docs})

    return {
        "total_owned_documents": total_owned,
        "shared_documents_count": shared_count,
        "active_permission_grants": active_grants,
        "recent_events": [],
        "categories": categories,
    }


@router.get("/viewer/stats", response_model=ViewerDashboardStats)
def get_viewer_stats(
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Metrics for Viewer dashboard."""
    perms = (
        db.query(DocumentPermission, Document)
        .join(Document, DocumentPermission.document_id == Document.id)
        .filter(
            DocumentPermission.user_id == viewer.id,
            DocumentPermission.is_active == True,
            Document.tenant_id == viewer.tenant_id,
            Document.is_archived == False,
        )
        .all()
    )

    categories = list({d.category for _, d in perms})

    return {
        "total_accessible_documents": len(perms),
        "categories": categories,
    }


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    title: str = Form(..., min_length=1, max_length=255),
    category: str = Form(default="General", max_length=64),
    description: str = Form(default=None),
    file: UploadFile = File(...),
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    """
    Secure document upload endpoint.
    Restricted to Document Owners.
    Validates MIME type, file extension, magic signature, and size.
    Stores file using random server-generated UUID key in private storage.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    mime_type = file.content_type or "application/octet-stream"

    # Save to private vault storage with magic signature validation
    storage_key, clean_filename, file_size, sha256_hash = save_document_bytes(
        content=content,
        original_filename=file.filename or "unnamed_document",
        mime_type=mime_type,
    )

    # Create document record
    doc = Document(
        tenant_id=owner.tenant_id,
        owner_id=owner.id,
        title=title.strip(),
        description=description.strip() if description else None,
        category=category.strip() or "General",
        storage_key=storage_key,
        original_filename=clean_filename,
        file_size=file_size,
        mime_type=mime_type,
        file_hash_sha256=sha256_hash,
        is_archived=False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Append-only tamper-evident audit log
    record_audit_event(
        db=db,
        tenant_id=owner.tenant_id,
        action="DOC_UPLOAD",
        resource_type="DOCUMENT",
        resource_id=doc.id,
        outcome="SUCCESS",
        actor_id=owner.id,
        actor_email=owner.email,
        details={
            "title": doc.title,
            "filename": doc.original_filename,
            "size": doc.file_size,
            "category": doc.category,
            "sha256": doc.file_hash_sha256,
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return DocumentResponse(
        id=doc.id,
        tenant_id=doc.tenant_id,
        owner_id=doc.owner_id,
        title=doc.title,
        description=doc.description,
        category=doc.category,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        file_hash_sha256=doc.file_hash_sha256,
        is_archived=doc.is_archived,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        owner_name=owner.full_name,
        owner_email=owner.email,
    )


@router.get("", response_model=list[DocumentResponse])
@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    search: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List documents accessible to current user.
    - Owners see documents they own.
    - Viewers see ONLY documents explicitly shared with them via active permissions.
    - Zero metadata leakage: Viewers never see documents not shared with them.
    - Administrators should use /api/admin/documents for governance metadata.
    """
    if current_user.role == "ADMIN":
        # Redirect admins to administrative metadata endpoint
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators must monitor documents via the /api/admin/documents metadata view. Direct access forbidden."
        )

    if current_user.role == "DOCUMENT_OWNER":
        query = (
            db.query(Document, User.full_name, User.email)
            .join(User, Document.owner_id == User.id)
            .filter(
                Document.tenant_id == current_user.tenant_id,
                Document.owner_id == current_user.id,
                Document.is_archived == False,
            )
        )
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(Document.title.ilike(s))
        if category:
            query = query.filter(Document.category == category)

        results = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
        docs = []
        for doc, o_name, o_email in results:
            docs.append(DocumentResponse(
                id=doc.id,
                tenant_id=doc.tenant_id,
                owner_id=doc.owner_id,
                title=doc.title,
                description=doc.description,
                category=doc.category,
                original_filename=doc.original_filename,
                file_size=doc.file_size,
                mime_type=doc.mime_type,
                file_hash_sha256=doc.file_hash_sha256,
                is_archived=doc.is_archived,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                owner_name=o_name,
                owner_email=o_email,
                user_permission="OWNER",
            ))
        return docs

    # Viewer role: strictly active granted permissions only
    query = (
        db.query(Document, User.full_name, User.email, DocumentPermission.permission_level)
        .join(DocumentPermission, Document.id == DocumentPermission.document_id)
        .join(User, Document.owner_id == User.id)
        .filter(
            Document.tenant_id == current_user.tenant_id,
            DocumentPermission.user_id == current_user.id,
            DocumentPermission.is_active == True,
            Document.is_archived == False,
        )
    )
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(Document.title.ilike(s))
    if category:
        query = query.filter(Document.category == category)

    results = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    docs = []
    for doc, o_name, o_email, perm_level in results:
        docs.append(DocumentResponse(
            id=doc.id,
            tenant_id=doc.tenant_id,
            owner_id=doc.owner_id,
            title=doc.title,
            description=doc.description,
            category=doc.category,
            original_filename=doc.original_filename,
            file_size=doc.file_size,
            mime_type=doc.mime_type,
            file_hash_sha256=doc.file_hash_sha256,
            is_archived=doc.is_archived,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            owner_name=o_name,
            owner_email=o_email,
            user_permission=perm_level,
        ))
    return docs


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Strictly check tenant isolation
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.tenant_id == current_user.tenant_id)
        .first()
    )
    if not doc:
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=document_id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "Document not found or cross-tenant query"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Administrator cannot access confidential documents
    if current_user.role == "ADMIN":
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=doc.id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "Administrator content access forbidden"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators are strictly prohibited from accessing confidential document details."
        )

    # Check permission
    user_permission = None
    if doc.owner_id == current_user.id:
        user_permission = "OWNER"
    else:
        perm = (
            db.query(DocumentPermission)
            .filter(
                DocumentPermission.document_id == doc.id,
                DocumentPermission.user_id == current_user.id,
                DocumentPermission.is_active == True,
            )
            .first()
        )
        if not perm:
            record_audit_event(
                db=db,
                tenant_id=current_user.tenant_id,
                action="DOC_ACCESS_DENIED",
                resource_type="DOCUMENT",
                resource_id=doc.id,
                outcome="DENIED",
                actor_id=current_user.id,
                actor_email=current_user.email,
                details={"reason": "No active permission"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Document is not shared with you.")
        user_permission = perm.permission_level

    # Record view audit event
    record_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        action="DOC_VIEW",
        resource_type="DOCUMENT",
        resource_id=doc.id,
        outcome="SUCCESS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={"permission": user_permission},
        ip_address=client_ip,
        user_agent=user_agent,
    )

    owner = db.query(User).filter(User.id == doc.owner_id).first()

    return DocumentResponse(
        id=doc.id,
        tenant_id=doc.tenant_id,
        owner_id=doc.owner_id,
        title=doc.title,
        description=doc.description,
        category=doc.category,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        file_hash_sha256=doc.file_hash_sha256,
        is_archived=doc.is_archived,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
        user_permission=user_permission,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure file streaming endpoint.
    Guarantees:
    - Zero permanent public URLs.
    - Authorization validated on every request.
    - Administrators strictly blocked.
    - Revoked viewers immediately blocked.
    - Audit event DOC_DOWNLOAD or DOC_ACCESS_DENIED recorded.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # 1. Enforce separation of administrative duties
    if current_user.role == "ADMIN":
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=document_id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "Administrator download attempt blocked"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators are strictly prohibited from downloading confidential document content."
        )

    # 2. Query document with strict tenant boundary
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.tenant_id == current_user.tenant_id)
        .first()
    )
    if not doc:
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=document_id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "Document not found or cross-tenant download attempt"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # 3. Check access rights: owner or active permission
    has_access = False
    perm_level = None
    if doc.owner_id == current_user.id:
        has_access = True
        perm_level = "OWNER"
    else:
        active_perm = (
            db.query(DocumentPermission)
            .filter(
                DocumentPermission.document_id == doc.id,
                DocumentPermission.user_id == current_user.id,
                DocumentPermission.is_active == True,
            )
            .first()
        )
        if active_perm:
            has_access = True
            perm_level = active_perm.permission_level

    if not has_access:
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=doc.id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "Unauthorized download attempt or permission revoked"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have active permission to download this document."
        )

    # 4. Record successful download audit event
    record_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        action="DOC_DOWNLOAD",
        resource_type="DOCUMENT",
        resource_id=doc.id,
        outcome="SUCCESS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={
            "permission": perm_level,
            "filename": doc.original_filename,
            "size": doc.file_size,
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Stream from private storage
    stream = read_document_stream(doc.storage_key)
    safe_filename = doc.original_filename.replace('"', '\\"')
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_filename}"',
        "Content-Type": doc.mime_type,
        "Content-Length": str(doc.file_size),
        "X-Content-Type-Options": "nosniff",
    }
    return StreamingResponse(stream, headers=headers)


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document_metadata(
    document_id: str,
    req: DocumentUpdateMetadataRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.tenant_id == current_user.tenant_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Owner or active EDIT permission allowed
    can_edit = False
    if doc.owner_id == current_user.id:
        can_edit = True
    else:
        perm = (
            db.query(DocumentPermission)
            .filter(
                DocumentPermission.document_id == doc.id,
                DocumentPermission.user_id == current_user.id,
                DocumentPermission.is_active == True,
                DocumentPermission.permission_level == "EDIT",
            )
            .first()
        )
        if perm:
            can_edit = True

    if not can_edit:
        record_audit_event(
            db=db,
            tenant_id=current_user.tenant_id,
            action="DOC_ACCESS_DENIED",
            resource_type="DOCUMENT",
            resource_id=doc.id,
            outcome="DENIED",
            actor_id=current_user.id,
            actor_email=current_user.email,
            details={"reason": "EDIT permission required"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have EDIT permissions for this document."
        )

    if req.title:
        doc.title = req.title.strip()
    if req.description is not None:
        doc.description = req.description.strip()
    if req.category:
        doc.category = req.category.strip()

    doc.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)

    record_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        action="DOC_METADATA_UPDATE",
        resource_type="DOCUMENT",
        resource_id=doc.id,
        outcome="SUCCESS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={"title": doc.title, "category": doc.category},
        ip_address=client_ip,
        user_agent=user_agent,
    )

    owner = db.query(User).filter(User.id == doc.owner_id).first()

    return DocumentResponse(
        id=doc.id,
        tenant_id=doc.tenant_id,
        owner_id=doc.owner_id,
        title=doc.title,
        description=doc.description,
        category=doc.category,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        file_hash_sha256=doc.file_hash_sha256,
        is_archived=doc.is_archived,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    request: Request,
    owner: User = Depends(require_document_owner),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tenant_id == owner.tenant_id,
            Document.owner_id == owner.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you are not the owner."
        )

    # Delete underlying storage file
    delete_document_file(doc.storage_key)

    doc_title = doc.title
    db.delete(doc)
    db.commit()

    record_audit_event(
        db=db,
        tenant_id=owner.tenant_id,
        action="DOC_DELETE",
        resource_type="DOCUMENT",
        resource_id=document_id,
        outcome="SUCCESS",
        actor_id=owner.id,
        actor_email=owner.email,
        details={"title": doc_title},
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {"status": "success", "message": "Document deleted successfully."}
