from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import SessionLocal, init_db
from app.services.log_broadcaster import broadcaster
from app import scheduler as sched

limiter = Limiter(key_func=get_remote_address)


def _init_auth() -> None:
    """Hash the plain-text password from env and store it in DB on first start."""
    from app.auth import get_jwt_secret, hash_password
    from app.config import get_settings
    from app.services.db_config import get, set_

    settings = get_settings()
    db = SessionLocal()
    try:
        get_jwt_secret()
        if settings.password:
            existing = get(db, "auth.password_hash")
            if not existing:
                set_(db, "auth.password_hash", hash_password(settings.password))
    finally:
        db.close()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self'; "
            "frame-ancestors 'none'"
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _init_auth()
    broadcaster.set_loop(__import__("asyncio").get_event_loop())
    await sched.start()
    yield
    await sched.stop()


app = FastAPI(title="Unstuckarr", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# CORS only needed in local dev (frontend on :5173, backend on :7676)
_dev_origins = os.environ.get("CORS_ORIGINS", "")
if _dev_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_dev_origins.split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )

from app.routers import auth, dashboard, queue, events, actions, config, ws  # noqa: E402

app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "version": "0.1.0"}


# Serve React SPA — must be registered last
_static_dir = os.environ.get("STATIC_DIR", "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
