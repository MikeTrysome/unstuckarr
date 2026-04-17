from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import SessionLocal, init_db
from app.services.log_broadcaster import broadcaster
from app import scheduler as sched


def _init_auth() -> None:
    """Hash the plain-text password from env and store it in DB on first start."""
    from app.auth import get_jwt_secret, hash_password
    from app.config import get_settings
    from app.services.db_config import get, set_

    settings = get_settings()
    db = SessionLocal()
    try:
        # Ensure JWT secret exists (auto-generated if absent)
        get_jwt_secret()

        if settings.password:
            existing = get(db, "auth.password_hash")
            if not existing:
                set_(db, "auth.password_hash", hash_password(settings.password))
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _init_auth()
    broadcaster.set_loop(__import__("asyncio").get_event_loop())
    await sched.start()
    yield
    await sched.stop()


app = FastAPI(title="Unstackarr", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
