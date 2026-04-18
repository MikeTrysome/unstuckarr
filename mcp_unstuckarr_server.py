#!/usr/bin/env python3
"""
MCP server — Unstuckarr API

Exposes the running Unstuckarr service (http://localhost:7676) as MCP tools
so Claude Code can query live data and trigger actions during development.

Configuration via environment variables:
  UNSTUCKARR_BASE_URL   default: http://localhost:7676
  UNSTUCKARR_PASSWORD   password for the web UI (same as UNSTUCKARR_PASSWORD)

Usage (add to .mcp.json):
  {
    "mcpServers": {
      "unstuckarr": {
        "type": "stdio",
        "command": "python",
        "args": ["mcp_unstuckarr_server.py"],
        "env": {
          "UNSTUCKARR_PASSWORD": "your-password-here"
        }
      }
    }
  }
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

BASE_URL = os.environ.get("UNSTUCKARR_BASE_URL", "http://localhost:7676").rstrip("/")
PASSWORD = os.environ.get("UNSTUCKARR_PASSWORD", "")

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
            resp = c.post("/api/auth/login", json={"password": PASSWORD})
            resp.raise_for_status()
            _token = resp.json().get("access_token")
            return _token
    except Exception as e:
        return None


def _auth_headers() -> dict[str, str]:
    token = _get_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _get(path: str) -> Any:
    """GET request with auto-auth. Returns parsed JSON or error dict."""
    global _token
    with _client() as c:
        resp = c.get(path, headers=_auth_headers())
        if resp.status_code == 401:
            # Token expired — clear and retry once
            _token = None
            resp = c.get(path, headers=_auth_headers())
        resp.raise_for_status()
        return resp.json()


def _post(path: str, body: dict | None = None) -> Any:
    """POST request with auto-auth. Returns parsed JSON or error dict."""
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
def get_dashboard() -> dict:
    """
    Get the Unstuckarr dashboard: last run time, next run time, total events,
    and per-instance stuck counts. Use this for a quick health check.
    """
    try:
        return _get("/api/dashboard")
    except Exception as e:
        return {"error": str(e), "hint": "Is Unstuckarr running on port 7676?"}


@server.tool()
def get_queue(instance: str = "") -> dict:
    """
    Get currently detected stuck download items.
    Args:
        instance: Optional filter — 'Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K', or '' for all
    """
    path = "/api/queue"
    if instance:
        path += f"?instance={instance}"
    try:
        return _get(path)
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_recent_events(limit: int = 20, instance: str = "", action: str = "") -> dict:
    """
    Get recent cleanup events from history.
    Args:
        limit: Number of events to return (default 20)
        instance: Filter by ARR instance name (optional)
        action: Filter by action: 'removed', 'dry_run', 'error', 'skipped' (optional)
    """
    params = f"?page_size={limit}"
    if instance:
        params += f"&instance={instance}"
    if action:
        params += f"&action={action}"
    try:
        return _get(f"/api/events{params}")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_recent_runs(limit: int = 5) -> dict:
    """
    Get the last N scheduler runs with status (success/error/running) and counts.
    Args:
        limit: Number of runs to return (default 5)
    """
    try:
        return _get(f"/api/actions/runs?page_size={limit}")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def trigger_dry_run() -> dict:
    """
    Trigger a dry-run cleanup right now. Returns run_id.
    A dry-run detects stuck items and logs what WOULD happen, but makes no changes.
    """
    try:
        return _post("/api/actions/dry-run")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def trigger_cleanup() -> dict:
    """
    Trigger a real cleanup run right now. Returns run_id.
    WARNING: This will actually remove stuck items from the ARR queue and blocklist them.
    Only use this if you are sure there are stuck items that need removing.
    """
    try:
        return _post("/api/actions/execute")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def get_config() -> dict:
    """
    Get the current Unstuckarr configuration (secrets are masked).
    Useful for checking thresholds, scheduler settings, and which instances are enabled.
    """
    try:
        return _get("/api/config")
    except Exception as e:
        return {"error": str(e)}


@server.tool()
def health_check() -> dict:
    """
    Check if the Unstuckarr service is reachable and healthy.
    Does not require authentication.
    """
    try:
        with _client() as c:
            resp = c.get("/health")
            return resp.json()
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    server.run()
