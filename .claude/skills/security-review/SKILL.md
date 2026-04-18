---
name: security-review
description: Run a targeted security review of recent code changes. Use when the user asks for a security check or after significant changes.
disable-model-invocation: false
allowed-tools: Bash(git diff *), Bash(git log *), Grep, Read
---

# Security Review

## What to Check

### 1. Secrets & Credentials
- Search for hardcoded strings that look like API keys, passwords, tokens
- Check that `.env` files are in `.gitignore`
- Verify no secrets appear in `git diff` or `git log -p`
- Command: `git diff HEAD~5` to see recent changes

### 2. Auth Bypass Risks
- Every FastAPI route (except `/health`, `/api/auth/login`, static files) uses `Depends(get_current_user)`
- Check any new routes for missing auth dependency
- Check for commented-out auth or "TODO: add auth"

### 3. Input Validation
- New API endpoints use Pydantic models for request bodies (not raw dicts)
- Config keys written to DB are validated against an allowlist
- No f-string SQL queries anywhere

### 4. Dependency Issues
- If `requirements.txt` changed: check for known-vulnerable packages
- Use `pip-audit` if available: `python -m pip_audit`

### 5. Docker / Deployment
- Dockerfile still uses `USER appuser` (non-root)
- No new port exposures in `docker-compose.yml`
- No secrets in Dockerfile or docker-compose

### 6. Internationalization (important for this project)
- No new `toLocaleString('nl')` or any hardcoded locale
- No hardcoded timezone names in display code
- Backend log messages still in English

## Output Format

Report findings grouped by severity:
- 🔴 **Critical** — Must fix before deploy (auth bypass, leaked secret, SQL injection)
- 🟠 **Medium** — Should fix soon (missing input validation, weak error messages)
- 🟢 **Low** — Nice to have (minor hardening, style inconsistency)

If nothing is found: "No security issues found in recent changes."
