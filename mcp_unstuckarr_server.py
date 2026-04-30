#!/usr/bin/env python3
"""
MCP server — Unstuckarr API

Exposes the running Unstuckarr service as MCP tools so Claude Code can
query live data and trigger actions during development/troubleshooting.

Configuration via environment variables:
  UNSTUCKARR_BASE_URL   default: http://192.168.1.135:7676
  UNSTUCKARR_USERNAME   Unstuckarr login username
  UNSTUCKARR_PASSWORD   Unstuckarr login password
"""

from __future__ import annotations

import os
import sys
from typing import Any

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx", file=sys.stderr)
    sys.exit(1)

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("ERROR: mcp not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL  = os.environ.get("UNSTUCKARR_BASE_URL", "http://192.168.1.135:7676").rstrip("/")
USERNAME  = os.environ.get("UNSTUCKARR_USERNAME", "")
PASSWORD  = os.environ.get("UNSTUCKARR_PASSWORD", "")

_token: str | None = None


def _client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=15.0)


def _get_token() -> str | None:
    """Log in and return a JWT token, or None if login fails."""
    global _token
    if _token:
        return _token
    if not PASSWORD:
        return None
    try:
        with _client() as c:
            resp = c.post("/api/auth/login", json={"username": USERNAME, "password": PASSWORD})
            resp.raise_for_status()
            _token = resp.json().get("token")
            return _token
    except Exception as e:
        print(f"Unstuckarr login failed: {e}", file=sys.stderr)
        return None


def _auth_headers() -> dict[str, str]:
    token = _get_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _get(path: str) -> Any:
    """GET with auto-auth and one token-refresh retry on 401."""
    global _token
    with _client() as c:
        resp = c.get(path, headers=_auth_headers())
        if resp.status_code == 401:
            _token = None
            resp = c.get(path, headers=_auth_headers())
        resp.raise_for_status()
        return resp.json()


def _post(path: str, body: dict | None = None) -> Any:
    """POST with auto-auth and one token-refresh retry on 401."""
    global _token
    with _client() as c:
        resp = c.post(path, json=body or {}, headers=_auth_headers())
        if resp.status_code == 401:
            _token = None
            resp = c.post(path, json=body or {}, headers=_auth_headers())
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

server = FastMCP(name="unstuckarr")


@server.tool()
def health_check() -> dict:
    """
    Check if the Unstuckarr service is reachable and healthy.
    Does not require authentication. Use this first when troubleshooting.
    """
    try:
        with _client() as c:
            resp = c.get("/health")
            return resp.json()
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


@server.tool()
def get_dashboard() -> dict:
    """
    Get the Unstuckarr dashboard: last run time, next run time, scheduler status,
    dry_run flag, and per-instance stuck counts. Use for a quick health/status check.
    """
    try:
        return _get("/api/dashboard")
    except Exception as e:
        return {"error": str(e), "hint": "Is Unstuckarr running?"}


@server.tool()
def get_config() -> dict:
    """
    Get the current Unstuckarr configuration (secrets are masked).
    Shows thresholds, scheduler settings, detection config, enabled instances.
    """
    try:
        return _get("/api/config")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_recent_runs(limit: int = 5) -> dict:
    """
    Get the last N scheduler runs with status (success/error/running) and counts.
    Use this to verify Unstuckarr is actually running and what it's doing.
    Args:
        limit: Number of runs to return (default 5)
    """
    try:
        return _get(f"/api/actions/runs?page_size={limit}")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_recent_events(
    limit: int = 30,
    instance: str = "",
    action: str = "",
    download_hash: str = "",
) -> dict:
    """
    Get recent cleanup events: what Unstuckarr has done (removed, retried, dry_run, etc.).
    Args:
        limit: Number of events (default 30)
        instance: Filter by ARR instance: 'Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K'
        action: Filter by action: 'removed', 'dry_run', 'error', 'skipped'
        download_hash: Filter by torrent hash (partial match not supported — use full hash)
    """
    params = f"?page_size={limit}"
    if instance:
        params += f"&instance={instance}"
    if action:
        params += f"&action={action}"
    if download_hash:
        params += f"&download_hash={download_hash.lower()}"
    try:
        return _get(f"/api/events{params}")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_stuck_queue(instance: str = "") -> dict:
    """
    Get currently detected stuck items with their strike counts and thresholds.
    These are items Unstuckarr will act on in the next run.
    Args:
        instance: Optional filter — 'Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K'
    """
    path = "/api/queue"
    if instance:
        path += f"?instance={instance}"
    try:
        return _get(path)
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_monitoring_queue(instance: str = "") -> dict:
    """
    Get items being watched but not yet acted on.
    These have ARR warning status but no confirmed RDT error yet — Unstuckarr
    is observing them and will escalate if the error is confirmed.
    Args:
        instance: Optional filter — 'Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K'
    """
    path = "/api/queue/monitoring"
    if instance:
        path += f"?instance={instance}"
    try:
        return _get(path)
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_strikes(download_hash: str = "") -> list:
    """
    Get all active strikes in the database.
    Strikes accumulate per (hash, instance) until the threshold is reached.
    Args:
        download_hash: Optional — filter to a specific torrent hash
    """
    path = "/api/queue/strikes"
    if download_hash:
        path += f"?hash={download_hash.lower()}"
    try:
        return _get(path)
    except Exception as e:
        return [{"error": str(e)}]


@server.tool()
def get_rdt_torrents_via_unstuckarr() -> list:
    """
    Get raw RDT torrent list as seen by Unstuckarr (proxied through Unstuckarr's
    own RDT connection). Useful for verifying Unstuckarr can reach RDT-client.
    """
    try:
        return _get("/api/queue/rdt-torrents")
    except Exception as e:
        return [{"error": str(e)}]


@server.tool()
def trigger_dry_run() -> dict:
    """
    Trigger a dry-run cleanup right now.
    Detects stuck items and logs what WOULD happen — no changes made.
    Check get_recent_events() afterwards to see what it found.
    """
    try:
        return _post("/api/actions/dry-run")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def trigger_cleanup() -> dict:
    """
    Trigger a real cleanup run right now.
    WARNING: Will actually remove stuck items from ARR and blocklist them.
    Only use when you're sure there are items that need removing.
    """
    try:
        return _post("/api/actions/execute")
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    server.run()
