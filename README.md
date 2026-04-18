# Unstuckarr

> **⚠️ WORK IN PROGRESS — NOT READY FOR USE**
>
> This project is actively under development. It is **not functional yet** and should not be used in a production environment.
> Breaking changes will occur without notice. Use at your own risk.

---

Unstuckarr automatically detects and removes stuck downloads from your Sonarr/Radarr queue when using RDT-client with Real-Debrid.

## Features (planned)

- 🔍 Automatic detection of stuck downloads (infringing files, canceled tasks)
- 🧹 Automatic removal + blocklist + re-search
- 📊 Web UI with live logs, history, and dashboard
- ⚙️ Full configuration via Settings UI — no environment variables required
- 🔔 Notifications via Apprise (Discord, Telegram, Ntfy, etc.)
- 🔐 Encrypted storage of API keys and credentials

## Status

| Component | Status |
|---|---|
| Backend (FastAPI) | 🚧 In development |
| Frontend (React) | 🚧 In development |
| Docker image | 🚧 Not stable |
| Unraid template | 🚧 Not ready |
| Documentation | 🚧 Not written |

## Installation (when ready)

> ⚠️ Not ready for installation. Instructions will be added once the project reaches a stable state.

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 7676

# Frontend
cd frontend && npm install
npm run dev

# Docker
docker compose up --build
```

## License

MIT
