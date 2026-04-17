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


class LoginRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """Public endpoint — tells the frontend whether a password has been configured."""
    has_password = bool(get(db, "auth.password_hash"))
    return {"configured": has_password}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    password_hash = get(db, "auth.password_hash")
    if not password_hash:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No password configured. Set ARRSM_PASSWORD and restart.",
        )
    if not auth.verify_password(body.password, password_hash):
        logger.warning("Failed login attempt from %s", request.client.host if request.client else "unknown")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

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
