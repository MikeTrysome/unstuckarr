---
paths:
  - "**/*.py"
  - "**/*.ts"
  - "**/*.tsx"
---

# Security Rules

## Secrets — Storage Rules

Secrets are **never**:
- Hardcoded in Python or TypeScript files
- Committed to git
- Returned in API responses in plaintext (return `_set: bool` or mask with `***`)

**Connection credentials** (API keys, RDT password) are stored in the `config_entries` DB table,
**encrypted at rest** via `app.crypto` (Fernet AES-128). The encryption key lives in
`{DATA_DIR}/.secret_key` (mode 0o400, owner-read-only). Never log or expose this key.

**Auth password** is bcrypt-hashed (one-way), never stored as plaintext anywhere.

**JWT secret** is a random 32-byte hex string, stored as plaintext in `config_entries`
(intentionally, as it provides no user-data protection and is safe to regenerate).

`UNSTUCKARR_PASSWORD` env var support has been removed — password is set via the `/setup` UI.

## Auth — Backend

Every API route (except `/health`, `/api/auth/login`, and static files) requires a valid JWT token:

```python
# All protected routes use:
current_user: str = Depends(get_current_user)
```

Do not add unauthenticated shortcuts "for development convenience". Use dry-run mode instead.

## Auth — Frontend

Check `isAuthenticated()` from `lib/auth.ts` before rendering any protected content. The function validates the token AND its expiry timestamp.

On any 401 from the API: clear the token and redirect to `/login`. Do not silently retry with a stale token.

## Rate Limiting

The `/api/auth/login` endpoint is rate-limited to 10 requests/minute per IP via `slowapi`. Do not disable this. Do not add other unauthenticated endpoints without rate limiting.

## Input Validation

All external input (env vars, API request bodies, config form values) goes through Pydantic models. Never use raw dicts from `request.json()` without schema validation.

For config keys stored in the database, validate against an allowlist of known keys before writing.

## SQL — No Raw Queries

Never write raw SQL strings. Use SQLAlchemy ORM or SQLAlchemy Core with bound parameters. SQLite injection is unlikely in a home setup but the discipline matters.

## CORS

CORS is only enabled when `UNSTUCKARR_CORS_ORIGINS` is explicitly set. In production (Docker, same-origin), CORS is disabled. Do not enable wildcard CORS.

## Security Headers

Applied by `SecurityHeadersMiddleware` in `main.py`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restrictive, scripts from self only

Do not weaken these headers. If a new feature requires relaxing CSP (e.g., inline scripts), use nonces — not `unsafe-inline`.

## Docker

- Never run the container as root (Dockerfile uses `USER appuser`)
- Expose only port 7676 — no extra ports
- The `/data` volume contains only the SQLite database, no secrets
