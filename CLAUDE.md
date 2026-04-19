# Unstuckarr

FastAPI + React Docker service that detects and removes stuck downloads from Sonarr/Radarr + RDT-client.

- **Docker Hub:** `dockersftw/unstuckarr:latest` | **GitHub:** `MikeTrysome/unstuckarr` | **Port:** 7676
- Data volume: `/data` (SQLite at `/data/unstuckarr.db`) | Encryption key: `/data/.secret_key`

## Key Architecture

- `cleanup_service.run_cleanup()` is **synchronous** — only call via `run_in_executor` from async context
- Scheduler: `AsyncIOScheduler` with `_job_running` guard — overlapping runs are dropped, not queued
- Auth: bcrypt + JWT HS256 (7-day expiry) — login rate-limited to 10/min via slowapi
- Notifications: Apprise (`notification_service.py`) — configured via Settings UI, not env vars
- SQLite WAL mode, sync SQLAlchemy (`check_same_thread=False`)
- No CORS in production — same-origin only; only enabled when `CORS_ORIGINS` env var is set

## ARR Instances (home setup)

| Instance | Port |
|---|---|
| Sonarr | 8989 |
| Sonarr-4K | 8990 |
| Radarr | 7878 |
| Radarr-4K | 7879 |
| RDT-client | 6500 |

All on `192.168.1.x` (Unraid server).

## Environment Variables (`UNSTUCKARR_` prefix)

Env vars only seed the DB on first start. Change everything via Settings UI afterward.

- `SONARR_HOST/PORT/API_KEY`, `SONARR4K_*`, `RADARR_*`, `RADARR4K_*`
- `RDT_HOST/PORT/USERNAME/PASSWORD`
- `INTERVAL_MINUTES` (default: 10), `DATA_DIR` (default: `/data`)

## Git

Push to `main` → GitHub Actions → Docker Hub build. Style: `fix:`, `feat:`, `refactor:`, `docs:`
