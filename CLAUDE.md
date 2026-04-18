# Unstuckarr — Project Instructions

## What This Is
A FastAPI + React Docker service that detects and removes stuck downloads from the ARR stack (Sonarr/Radarr + RDT-client). Replaces a bash cleanup script with a persistent web service, history log, live logs via WebSocket, and a settings UI.

**Docker Hub:** `dockersftw/unstuckarr:latest`
**GitHub:** `MikeTrysome/unstuckarr`
**Default port:** 7676

---

## Project Layout

```
unstuckarr/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app factory, lifespan, middleware
│       ├── config.py            # Pydantic Settings (env prefix UNSTUCKARR_)
│       ├── database.py          # SQLAlchemy engine, WAL mode, SessionLocal
│       ├── scheduler.py         # APScheduler + run_in_executor + _job_running guard
│       ├── adapters/
│       │   ├── base.py          # Abstract DownloadClientAdapter
│       │   └── rdt_adapter.py   # RDT-client HTTP adapter (httpx sync)
│       ├── models/              # SQLAlchemy ORM (event, config, run)
│       ├── routers/             # FastAPI routers (dashboard, queue, events, config, auth, ws)
│       ├── schemas/             # Pydantic schemas; UtcModel base for UTC tagging
│       └── services/
│           ├── cleanup_service.py   # Orchestrator — call from thread only
│           ├── arr_service.py       # ARR HTTP client
│           ├── detection.py         # Pure functions, no side effects
│           ├── db_config.py         # Key-value DB config helpers
│           └── log_broadcaster.py   # asyncio pub/sub for WebSocket logs
├── frontend/                    # React + Tailwind + shadcn/ui (Vite)
│   └── src/
│       ├── pages/               # Dashboard, Queue, Events, Logs, Settings
│       ├── components/          # layout/, dashboard/, queue/, events/, logs/, settings/
│       ├── hooks/               # useWebSocket, useApi, usePolling
│       └── lib/                 # api.ts, auth.ts
├── .claude/                     # Claude Code configuration (committed)
├── mcp_unstuckarr_server.py     # MCP server for Claude Code ↔ Unstuckarr API
├── Dockerfile                   # Multi-stage: Node build → Python image
├── docker-compose.yml           # Local dev
└── unraid-template.xml          # Unraid Community Apps template
```

---

## Build & Run Commands

```bash
# Backend (from unstuckarr/)
cd backend && pip install -r requirements.txt
cd backend && uvicorn app.main:app --reload --port 7676

# Frontend (from unstuckarr/)
cd frontend && npm install
cd frontend && npm run dev          # dev server :5173 with Vite proxy to :7676
cd frontend && npm run build        # production build → frontend/dist/

# Docker (from unstuckarr/)
docker compose up --build           # full stack
docker compose up -d                # detached

# Tests
cd backend && pytest tests/ -v

# Linting
cd backend && python -m black app/
cd backend && python -m ruff check app/
```

---

## Critical Coding Rules

### Python (backend)
- **Always** `datetime.now(timezone.utc)` — never `datetime.utcnow()` (deprecated)
- All timestamps stored as UTC in SQLite, all API responses include `+00:00`
- Use `UtcModel` (from `app/schemas/__init__.py`) as base for Pydantic response schemas
- `cleanup_service.run_cleanup()` is **synchronous** — only call it via `run_in_executor`
- `detection.py` must stay side-effect-free (no logging, no DB, no HTTP)
- SQLAlchemy is **sync** (not async) — `check_same_thread=False` on engine
- DB session pattern: `db = SessionLocal()` → `try/finally: db.close()`
- On exception: `db.rollback()` first, then attempt error-status write, then `raise`

### TypeScript / React (frontend)
- Always `toLocaleString()` without locale parameter — browser uses user's own locale
- Never hardcode locale strings like `'nl'` or `'en-US'`
- Auth token key: `unstuckarr_token` in localStorage
- API base URL via Vite proxy in dev, same-origin in production

### Docker / Deployment
- Image: `dockersftw/unstuckarr:latest`
- Data volume: `/data` (SQLite lives at `/data/unstuckarr.db`)
- Port: 7676 everywhere (Dockerfile, docker-compose, Unraid template)
- CI/CD: push to `main` branch → GitHub Actions builds + pushes to Docker Hub

---

## Environment Variables (all prefixed `UNSTUCKARR_`)

| Variable | Default | Notes |
|---|---|---|
| `UNSTUCKARR_SONARR_HOST` | `192.168.1.135` | Seeds DB on first start; edit via Settings UI |
| `UNSTUCKARR_SONARR_PORT` | `8989` | Seeds DB on first start |
| `UNSTUCKARR_SONARR_API_KEY` | `""` | Seeds DB (encrypted) on first start |
| `UNSTUCKARR_SONARR4K_*` | | Same pattern |
| `UNSTUCKARR_RADARR_*` | | Same pattern |
| `UNSTUCKARR_RADARR4K_*` | | Same pattern |
| `UNSTUCKARR_RDT_HOST` | `192.168.1.135` | Seeds DB on first start |
| `UNSTUCKARR_RDT_PORT` | `6500` | Seeds DB on first start |
| `UNSTUCKARR_RDT_USERNAME` | `""` | Seeds DB on first start |
| `UNSTUCKARR_RDT_PASSWORD` | `""` | Seeds DB (encrypted) on first start |
| `UNSTUCKARR_INTERVAL_MINUTES` | `10` | Cleanup interval |
| `UNSTUCKARR_DATA_DIR` | `/data` | SQLite directory |

**Note:** All connection settings can be configured (and changed) via the Settings UI.
Env vars are only needed if you want to pre-seed settings at first start. They are NOT required.

**Encryption:** API keys and the RDT password are encrypted at rest (Fernet AES-128).
Encryption key: `{DATA_DIR}/.secret_key` (generated on first start). Never expose this file.

---

## Key Architecture Decisions

- **Scheduler:** `AsyncIOScheduler` with `_job_running` guard — overlapping runs are dropped, not queued
- **Auth:** bcrypt password + JWT (HS256, 7-day expiry) — rate-limited login endpoint (10/min)
- **Security headers:** `X-Frame-Options: DENY`, CSP, `X-Content-Type-Options: nosniff`
- **No CORS in production** — same-origin only; CORS only when `UNSTUCKARR_CORS_ORIGINS` env var is set
- **WAL mode + foreign_keys=ON** on SQLite engine connect
- **Notification:** Apprise (notification_service.py) — configured via Settings UI

---

## ARR Instances (home setup)

| Instance | Port |
|---|---|
| Sonarr | 8989 |
| Sonarr-4K | 8990 |
| Radarr | 7878 |
| Radarr-4K | 7879 |
| RDT-client | 6500 |

All on `192.168.1.135`.

---

## Internationalization

- All log messages and backend strings: **English only**
- UI dates: `toLocaleString()` without locale — browser handles it
- No hardcoded timezone in display logic
- DB always stores UTC

---

## Git Workflow

- Branch: `main` (direct push for solo project)
- Push to `main` triggers GitHub Actions → Docker Hub build
- Commit convention: `fix:`, `feat:`, `refactor:`, `docs:`
