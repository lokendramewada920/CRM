"""Auth: password hashing, JWT, current user dependency, RBAC checks."""
import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from db import users, roles

_ph = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "12"))


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        _ph.verify(hashed, pw)
        return True
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_token(user_id: str, role: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await users.find_one({"id": payload["sub"], "active": True}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_effective_permissions(user: dict) -> set[str]:
    """Return the union of role default perms + user overrides."""
    role_doc = await roles.find_one({"name": user["role"]}, {"_id": 0}) or {}
    perms = set(role_doc.get("permissions", []))
    perms.update(user.get("permission_overrides", []) or [])
    for revoked in (user.get("permission_revokes", []) or []):
        perms.discard(revoked)
    return perms


def require_permission(*needed: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        perms = await get_effective_permissions(user)
        if not any(p in perms for p in needed):
            raise HTTPException(status_code=403, detail=f"Missing permission: {' or '.join(needed)}")
        return user
    return _dep


def require_role(*allowed: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Role not allowed")
        return user
    return _dep
