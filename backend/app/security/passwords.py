import argon2
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# Use Argon2id with robust enterprise parameters
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=4,
    hash_len=32,
    type=argon2.Type.ID
)

def hash_password(password: str) -> str:
    """Hash password using Argon2id with unique salt automatically generated."""
    return _hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored Argon2id hash with constant-time check."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def check_needs_rehash(hashed_password: str) -> bool:
    """Determine if a hash should be upgraded to newer security parameters."""
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except Exception:
        return True
