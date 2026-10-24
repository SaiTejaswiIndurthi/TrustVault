import hashlib
import os
import re
import uuid
from pathlib import Path
from fastapi import HTTPException, status
from backend.app.config import settings

MAGIC_SIGNATURES = {
    "application/pdf": [b"%PDF-"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [b"PK\x03\x04"],
}

def sanitize_filename(filename: str) -> str:
    """Sanitize original filename to prevent path traversal and XSS."""
    base = os.path.basename(filename)
    clean = re.sub(r"[^\w\s\.-]", "", base).strip()
    return clean or f"file_{uuid.uuid4().hex[:8]}"

def validate_magic_bytes(header: bytes, mime_type: str) -> bool:
    """Validate file content matches claimed MIME type using file signatures."""
    if mime_type == "text/plain":
        try:
            header.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    signatures = MAGIC_SIGNATURES.get(mime_type)
    if not signatures:
        # Default allow if MIME type doesn't have strict magic check configured
        return True

    return any(header.startswith(sig) for sig in signatures)

def get_storage_path(storage_key: str) -> Path:
    """
    Returns absolute Path for a storage key ensuring strict confinement inside STORAGE_DIR.
    Guarantees path traversal prevention.
    """
    base_dir = Path(settings.STORAGE_DIR).resolve()
    # Storage key must be pure hex / uuid characters
    if not re.match(r"^[a-zA-Z0-9_-]+$", storage_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage key")
    
    file_path = (base_dir / storage_key).resolve()
    if not str(file_path).startswith(str(base_dir)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal detected")
        
    return file_path

def save_document_bytes(content: bytes, original_filename: str, mime_type: str) -> tuple[str, str, int, str]:
    """
    Saves document to private storage.
    Returns (storage_key, sanitized_filename, file_size, sha256_hash).
    """
    file_size = len(content)
    if file_size > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)}MB"
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty files are not allowed"
        )

    # Magic byte validation
    header = content[:32]
    if not validate_magic_bytes(header, mime_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File content signature does not match declared MIME type ({mime_type})"
        )

    storage_key = uuid.uuid4().hex
    target_path = get_storage_path(storage_key)

    with open(target_path, "wb") as f:
        f.write(content)

    sha256_hash = hashlib.sha256(content).hexdigest()
    clean_filename = sanitize_filename(original_filename)

    return storage_key, clean_filename, file_size, sha256_hash

def read_document_stream(storage_key: str, chunk_size: int = 64 * 1024):
    """Secure generator to stream private document content without buffering entire file in memory."""
    target_path = get_storage_path(storage_key)
    if not target_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document storage file not found")

    def iter_file():
        with open(target_path, "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk

    return iter_file()

def delete_document_file(storage_key: str) -> bool:
    """Securely delete file from local private storage."""
    try:
        target_path = get_storage_path(storage_key)
        if target_path.exists():
            target_path.unlink()
            return True
        return False
    except Exception:
        return False
