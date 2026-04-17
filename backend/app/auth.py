from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

_bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(secret: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": "admin", "exp": expire}, secret, algorithm=ALGORITHM)


def verify_token(token: str, secret: str) -> bool:
    try:
        jwt.decode(token, secret, algorithms=[ALGORITHM])
        return True
    except JWTError:
        return False


def get_jwt_secret() -> str:
    """Load JWT secret from DB, generate and persist one if absent."""
    from app.database import SessionLocal
    from app.services.db_config import get, set_

    db = SessionLocal()
    try:
        secret = get(db, "auth.jwt_secret")
        if not secret:
            secret = secrets.token_hex(32)
            set_(db, "auth.jwt_secret", secret)
        return secret
    finally:
        db.close()


def _get_token_from_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    if credentials:
        return credentials.credentials
    return None


def require_auth(token: str | None = Depends(_get_token_from_request)) -> None:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    secret = get_jwt_secret()
    if not verify_token(token, secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_auth_ws(token: str | None = Query(None)) -> None:
    """For WebSocket endpoints: token passed as ?token= query param."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    secret = get_jwt_secret()
    if not verify_token(token, secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
