from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app import auth
from app.database import get_db
from app.services.db_config import get, set_

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


class SetupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangeUsernameRequest(BaseModel):
    current_password: str
    new_username: str


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """Public endpoint — tells the frontend whether credentials have been configured."""
    configured = bool(get(db, "auth.password_hash")) and bool(get(db, "auth.username"))
    return {"configured": configured}


@router.post("/setup")
def setup(body: SetupRequest, db: Session = Depends(get_db)):
    """
    One-time first-run setup. Only works when no credentials have been configured yet.
    Returns 409 if already set up — use /auth/change-password or /auth/change-username.
    """
    if get(db, "auth.password_hash"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already configured. Use change-password or change-username to update.",
        )
    if len(body.username.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username must be at least 3 characters",
        )
    if len(body.password) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 12 characters",
        )
    set_(db, "auth.username", body.username.strip())
    set_(db, "auth.password_hash", auth.hash_password(body.password))
    logger.info("Initial credentials set via setup endpoint")
    return {"ok": True}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    password_hash = get(db, "auth.password_hash")
    stored_username = get(db, "auth.username")
    if not password_hash or not stored_username:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Not configured. Complete the setup at /setup first.",
        )
    # Check username and password — use constant-time comparison for username too
    import hmac
    username_ok = hmac.compare_digest(body.username.strip().lower(), stored_username.lower())
    password_ok = auth.verify_password(body.password, password_hash)
    if not username_ok or not password_ok:
        logger.warning("Failed login attempt from %s", request.client.host if request.client else "unknown")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    secret = auth.get_jwt_secret()
    return {"token": auth.create_token(secret)}


@router.post("/change-password", dependencies=[Depends(auth.require_auth)])
def change_password(body: ChangePasswordRequest, db: Session = Depends(get_db)):
    password_hash = get(db, "auth.password_hash")
    if not auth.verify_password(body.current_password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    if len(body.new_password) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 12 characters",
        )
    set_(db, "auth.password_hash", auth.hash_password(body.new_password))
    return {"ok": True}


@router.post("/change-username", dependencies=[Depends(auth.require_auth)])
def change_username(body: ChangeUsernameRequest, db: Session = Depends(get_db)):
    password_hash = get(db, "auth.password_hash")
    if not auth.verify_password(body.current_password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect")
    if len(body.new_username.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username must be at least 3 characters",
        )
    set_(db, "auth.username", body.new_username.strip())
    return {"ok": True}
