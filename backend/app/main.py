from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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
    """Ensure the JWT secret exists in DB. Password is set via the /setup UI."""
    from app.auth import get_jwt_secret
    from app.services.db_config import get

    get_jwt_secret()

    # Migration: old password-only installs stored auth.password_hash without
    # auth.username. The new system requires both. If only the hash exists,
    # clear it so the user is prompted to go through the new setup flow.
    db = SessionLocal()
    try:
        has_hash = bool(get(db, "auth.password_hash"))
        has_username = bool(get(db, "auth.username"))
        if has_hash and not has_username:
            from app.models.config import ConfigEntry
            db.query(ConfigEntry).filter_by(key="auth.password_hash").delete()
            db.commit()
            import logging
            logging.getLogger(__name__).info(
                "Migrated old password-only auth — user will be prompted for new setup"
            )
    finally:
        db.close()


def _init_connections() -> None:
    """Seed DB connection config from env vars on first start (backward compatibility)."""
    from app.config import get_settings
    from app.services.db_config import get, set_

    settings = get_settings()
    db = SessionLocal()
    try:
        seeds = {
            "connection.sonarr.host":      settings.sonarr_host,
            "connection.sonarr.port":      settings.sonarr_port,
            "connection.sonarr.api_key":   settings.sonarr_api_key,
            "connection.sonarr4k.host":    settings.sonarr4k_host,
            "connection.sonarr4k.port":    settings.sonarr4k_port,
            "connection.sonarr4k.api_key": settings.sonarr4k_api_key,
            "connection.radarr.host":      settings.radarr_host,
            "connection.radarr.port":      settings.radarr_port,
            "connection.radarr.api_key":   settings.radarr_api_key,
            "connection.radarr4k.host":    settings.radarr4k_host,
            "connection.radarr4k.port":    settings.radarr4k_port,
            "connection.radarr4k.api_key": settings.radarr4k_api_key,
            "connection.rdt.host":         settings.rdt_host,
            "connection.rdt.port":         settings.rdt_port,
            "connection.rdt.username":     settings.rdt_username,
            "connection.rdt.password":     settings.rdt_password,
        }
        for key, value in seeds.items():
            if value and not get(db, key):
                set_(db, key, value)
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


def _mark_stale_runs() -> None:
    """Mark any 'running' entries left over from a previous process as 'interrupted'."""
    from app.models.run import SchedulerRun
    db = SessionLocal()
    try:
        stale = db.query(SchedulerRun).filter(SchedulerRun.status == "running").all()
        for run in stale:
            run.status = "interrupted"
        if stale:
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _init_auth()
    _init_connections()
    _mark_stale_runs()
    broadcaster.set_loop(__import__("asyncio").get_event_loop())
    await sched.start()
    yield
    await sched.stop()


app = FastAPI(title="Unstuckarr", version="0.2.0", lifespan=lifespan)

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

from app.routers import ignores  # noqa: E402
app.include_router(ignores.router, prefix="/api")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "version": "0.2.0"}


# Serve React SPA — must be registered last
_static_dir = os.environ.get("STATIC_DIR", "static")
if os.path.isdir(_static_dir):
    # Mount /assets separately so JS/CSS bundles are served efficiently
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Serve exact static files (favicon.svg, icons.svg, etc.)
        candidate = os.path.join(_static_dir, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # All other paths → index.html (React handles client-side routing)
        # No-cache so browsers always fetch fresh index.html after a container update
        index = os.path.join(_static_dir, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            })
        return JSONResponse({"detail": "Not Found"}, status_code=404)
