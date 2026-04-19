"""
Runtime-configurable settings stored in the database.
Connection settings (hosts, ports, API keys) are stored here DB-first,
seeded from env vars on first start for backward compatibility.

Secret values (API keys, passwords) are encrypted at rest using Fernet
symmetric encryption. The key is stored in {DATA_DIR}/.secret_key.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.config import ConfigEntry

# Keys whose string values are encrypted at rest via app.crypto
SECRET_KEYS: frozenset[str] = frozenset({
    "connection.sonarr.api_key",
    "connection.sonarr4k.api_key",
    "connection.radarr.api_key",
    "connection.radarr4k.api_key",
    "connection.rdt.password",
})

DEFAULTS: dict[str, Any] = {
    "detection.infringing_min_age_minutes": 15,
    "detection.canceled_min_age_minutes": 30,
    "detection.min_retry_count": 1,
    "scheduler.dry_run": False,
    "scheduler.enabled": True,
    "scheduler.interval_minutes": 10,
    "notifications.apprise_urls": [],
    "strikes.enabled": True,
    "strikes.infringing_threshold": 1,   # remove immediately on first strike
    "strikes.canceled_threshold": 3,     # require 3 strikes before removing
    "strikes.slow_threshold": 3,         # require 3 strikes for slow downloads
    "detection.slow_speed_enabled": False,
    "detection.slow_speed_threshold_kb": 500,
    "detection.slow_speed_min_age_minutes": 10,
    # Connection config (DB-first, env var seeded on startup)
    "connection.sonarr.host": "",
    "connection.sonarr.port": 8989,
    "connection.sonarr.api_key": "",
    "connection.sonarr.enabled": True,
    "connection.sonarr4k.host": "",
    "connection.sonarr4k.port": 8990,
    "connection.sonarr4k.api_key": "",
    "connection.sonarr4k.enabled": True,
    "connection.radarr.host": "",
    "connection.radarr.port": 7878,
    "connection.radarr.api_key": "",
    "connection.radarr.enabled": True,
    "connection.radarr4k.host": "",
    "connection.radarr4k.port": 7879,
    "connection.radarr4k.api_key": "",
    "connection.radarr4k.enabled": True,
    "connection.rdt.host": "",
    "connection.rdt.port": 6500,
    "connection.rdt.username": "",
    "connection.rdt.password": "",
    "connection.rdt.enabled": True,
    # auth.password_hash and auth.jwt_secret have no defaults — absence is meaningful
}

# Allowlist of all writable connection config keys
CONNECTION_KEYS: set[str] = {
    "connection.sonarr.host",
    "connection.sonarr.port",
    "connection.sonarr.api_key",
    "connection.sonarr.enabled",
    "connection.sonarr4k.host",
    "connection.sonarr4k.port",
    "connection.sonarr4k.api_key",
    "connection.sonarr4k.enabled",
    "connection.radarr.host",
    "connection.radarr.port",
    "connection.radarr.api_key",
    "connection.radarr.enabled",
    "connection.radarr4k.host",
    "connection.radarr4k.port",
    "connection.radarr4k.api_key",
    "connection.radarr4k.enabled",
    "connection.rdt.host",
    "connection.rdt.port",
    "connection.rdt.username",
    "connection.rdt.password",
    "connection.rdt.enabled",
}


def get(db: Session, key: str) -> Any:
    from app.crypto import decrypt

    entry = db.get(ConfigEntry, key)
    if entry is None or entry.value is None:
        return DEFAULTS.get(key)
    try:
        parsed = json.loads(entry.value)
    except Exception:
        parsed = entry.value
    # Decrypt secret keys transparently
    if key in SECRET_KEYS and isinstance(parsed, str):
        return decrypt(parsed)
    return parsed


def set_(db: Session, key: str, value: Any) -> None:
    from app.crypto import encrypt

    entry = db.get(ConfigEntry, key)
    if entry is None:
        entry = ConfigEntry(key=key)
        db.add(entry)
    # Encrypt secret string values before storing
    if key in SECRET_KEYS and isinstance(value, str) and value:
        entry.value = json.dumps(encrypt(value))
    else:
        entry.value = json.dumps(value)
    db.commit()


def get_all(db: Session) -> dict[str, Any]:
    """Return all config entries merged with defaults. Secret keys are decrypted."""
    from app.crypto import decrypt

    entries = db.query(ConfigEntry).all()
    db_values: dict[str, Any] = {}
    for e in entries:
        if e.value is None:
            continue
        try:
            parsed = json.loads(e.value)
        except Exception:
            parsed = e.value
        if e.key in SECRET_KEYS and isinstance(parsed, str):
            parsed = decrypt(parsed)
        db_values[e.key] = parsed
    return {**DEFAULTS, **db_values}


def update_many(db: Session, updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        set_(db, key, value)


def get_arr_instances_from_db(db: Session) -> list:
    """Returns list of ArrInstanceSettings, reading from DB with env var fallback."""
    from app.config import ArrInstanceSettings, get_settings

    settings = get_settings()

    configs = [
        ("Sonarr",    "sonarr",   settings.sonarr_host,   settings.sonarr_port,   settings.sonarr_api_key,   settings.sonarr_enabled,   "sonarr"),
        ("Sonarr-4K", "sonarr4k", settings.sonarr4k_host, settings.sonarr4k_port, settings.sonarr4k_api_key, settings.sonarr4k_enabled, "sonarr"),
        ("Radarr",    "radarr",   settings.radarr_host,   settings.radarr_port,   settings.radarr_api_key,   settings.radarr_enabled,   "radarr"),
        ("Radarr-4K", "radarr4k", settings.radarr4k_host, settings.radarr4k_port, settings.radarr4k_api_key, settings.radarr4k_enabled, "radarr"),
    ]
    instances = []
    for name, key, env_host, env_port, env_api_key, env_enabled, inst_type in configs:
        host    = get(db, f"connection.{key}.host")    or env_host
        port    = get(db, f"connection.{key}.port")    or env_port
        api_key = get(db, f"connection.{key}.api_key") or env_api_key
        enabled = get(db, f"connection.{key}.enabled")
        if enabled is None:
            enabled = env_enabled
        instances.append(ArrInstanceSettings(
            name=name, host=host, port=port, api_key=api_key, enabled=enabled, type=inst_type,
        ))
    return instances


def get_rdt_config_from_db(db: Session) -> dict:
    """Returns RDT connection config from DB with env var fallback."""
    from app.config import get_settings

    settings = get_settings()
    enabled = get(db, "connection.rdt.enabled")
    if enabled is None:
        enabled = settings.rdt_enabled
    return {
        "host":     get(db, "connection.rdt.host")     or settings.rdt_host,
        "port":     get(db, "connection.rdt.port")     or settings.rdt_port,
        "username": get(db, "connection.rdt.username") or settings.rdt_username,
        "password": get(db, "connection.rdt.password") or settings.rdt_password,
        "enabled":  enabled,
    }
