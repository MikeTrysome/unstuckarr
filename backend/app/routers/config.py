import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import require_auth
from app.database import get_db
from app.schemas.config import (
    ConnectionConfigIn,
    ConnectionConfigOut,
    DbConfigIn,
    DbConfigOut,
    FullConfigIn,
    FullConfigOut,
)
from app.services import db_config
from app.services.arr_service import ArrService


class ConnectionTestBody(BaseModel):
    """Optional override values for connection tests.
    If a field is omitted or None the stored DB value is used instead."""
    host: str | None = None
    port: int | None = None
    api_key: str | None = None
    username: str | None = None
    password: str | None = None

router = APIRouter(prefix="/config", tags=["config"], dependencies=[Depends(require_auth)])

_MASKED = "***"


def _is_secret_placeholder(value: str | None) -> bool:
    """Return True if the value should NOT overwrite the existing DB secret."""
    return value is None or value == "" or value == _MASKED


def _build_connection_out(db: Session) -> ConnectionConfigOut:
    instances = db_config.get_arr_instances_from_db(db)
    rdt = db_config.get_rdt_config_from_db(db)

    inst_map = {i.name: i for i in instances}
    sonarr   = inst_map.get("Sonarr")
    sonarr4k = inst_map.get("Sonarr-4K")
    radarr   = inst_map.get("Radarr")
    radarr4k = inst_map.get("Radarr-4K")

    return ConnectionConfigOut(
        sonarr_host=sonarr.host if sonarr else "",
        sonarr_port=sonarr.port if sonarr else 8989,
        sonarr_api_key_set=bool(sonarr.api_key) if sonarr else False,
        sonarr_enabled=sonarr.enabled if sonarr else True,
        sonarr4k_host=sonarr4k.host if sonarr4k else "",
        sonarr4k_port=sonarr4k.port if sonarr4k else 8990,
        sonarr4k_api_key_set=bool(sonarr4k.api_key) if sonarr4k else False,
        sonarr4k_enabled=sonarr4k.enabled if sonarr4k else True,
        radarr_host=radarr.host if radarr else "",
        radarr_port=radarr.port if radarr else 7878,
        radarr_api_key_set=bool(radarr.api_key) if radarr else False,
        radarr_enabled=radarr.enabled if radarr else True,
        radarr4k_host=radarr4k.host if radarr4k else "",
        radarr4k_port=radarr4k.port if radarr4k else 7879,
        radarr4k_api_key_set=bool(radarr4k.api_key) if radarr4k else False,
        radarr4k_enabled=radarr4k.enabled if radarr4k else True,
        rdt_host=rdt["host"],
        rdt_port=rdt["port"],
        rdt_username=rdt["username"],
        rdt_password_set=bool(rdt["password"]),
        rdt_enabled=rdt["enabled"],
    )


def _build_db_out(db: Session) -> DbConfigOut:
    cfg = db_config.get_all(db)
    return DbConfigOut(
        detection_infringing_min_age_minutes=cfg["detection.infringing_min_age_minutes"],
        detection_canceled_min_age_minutes=cfg["detection.canceled_min_age_minutes"],
        detection_min_retry_count=cfg["detection.min_retry_count"],
        scheduler_dry_run=cfg["scheduler.dry_run"],
        scheduler_enabled=cfg["scheduler.enabled"],
        scheduler_interval_minutes=cfg["scheduler.interval_minutes"],
        notifications_providers=cfg["notifications.providers"],
        strikes_enabled=cfg["strikes.enabled"],
        strikes_infringing_threshold=cfg["strikes.infringing_threshold"],
        strikes_canceled_threshold=cfg["strikes.canceled_threshold"],
        detection_slow_speed_enabled=cfg["detection.slow_speed_enabled"],
        detection_slow_speed_threshold_kb=cfg["detection.slow_speed_threshold_kb"],
        detection_slow_speed_min_age_minutes=cfg["detection.slow_speed_min_age_minutes"],
        detection_slow_min_completion_pct=cfg["detection.slow_min_completion_pct"],
        detection_slow_max_completion_pct=cfg["detection.slow_max_completion_pct"],
        strikes_slow_threshold=cfg["strikes.slow_threshold"],
    )


def _save_connections(db: Session, conn: ConnectionConfigIn) -> None:
    """Write connection config to DB. Secrets are skipped if placeholder/empty."""
    updates: dict = {}

    if conn.sonarr_host is not None:
        updates["connection.sonarr.host"] = conn.sonarr_host
    if conn.sonarr_port is not None:
        updates["connection.sonarr.port"] = conn.sonarr_port
    if not _is_secret_placeholder(conn.sonarr_api_key):
        updates["connection.sonarr.api_key"] = conn.sonarr_api_key
    if conn.sonarr_enabled is not None:
        updates["connection.sonarr.enabled"] = conn.sonarr_enabled

    if conn.sonarr4k_host is not None:
        updates["connection.sonarr4k.host"] = conn.sonarr4k_host
    if conn.sonarr4k_port is not None:
        updates["connection.sonarr4k.port"] = conn.sonarr4k_port
    if not _is_secret_placeholder(conn.sonarr4k_api_key):
        updates["connection.sonarr4k.api_key"] = conn.sonarr4k_api_key
    if conn.sonarr4k_enabled is not None:
        updates["connection.sonarr4k.enabled"] = conn.sonarr4k_enabled

    if conn.radarr_host is not None:
        updates["connection.radarr.host"] = conn.radarr_host
    if conn.radarr_port is not None:
        updates["connection.radarr.port"] = conn.radarr_port
    if not _is_secret_placeholder(conn.radarr_api_key):
        updates["connection.radarr.api_key"] = conn.radarr_api_key
    if conn.radarr_enabled is not None:
        updates["connection.radarr.enabled"] = conn.radarr_enabled

    if conn.radarr4k_host is not None:
        updates["connection.radarr4k.host"] = conn.radarr4k_host
    if conn.radarr4k_port is not None:
        updates["connection.radarr4k.port"] = conn.radarr4k_port
    if not _is_secret_placeholder(conn.radarr4k_api_key):
        updates["connection.radarr4k.api_key"] = conn.radarr4k_api_key
    if conn.radarr4k_enabled is not None:
        updates["connection.radarr4k.enabled"] = conn.radarr4k_enabled

    if conn.rdt_host is not None:
        updates["connection.rdt.host"] = conn.rdt_host
    if conn.rdt_port is not None:
        updates["connection.rdt.port"] = conn.rdt_port
    if conn.rdt_username is not None:
        updates["connection.rdt.username"] = conn.rdt_username
    if not _is_secret_placeholder(conn.rdt_password):
        updates["connection.rdt.password"] = conn.rdt_password
    if conn.rdt_enabled is not None:
        updates["connection.rdt.enabled"] = conn.rdt_enabled

    # Only write keys that are in the allowlist
    safe_updates = {k: v for k, v in updates.items() if k in db_config.CONNECTION_KEYS}
    if safe_updates:
        db_config.update_many(db, safe_updates)


@router.get("", response_model=FullConfigOut)
def get_config(db: Session = Depends(get_db)):
    return FullConfigOut(connections=_build_connection_out(db), db=_build_db_out(db))


@router.put("", response_model=FullConfigOut)
def update_config(body: FullConfigIn, db: Session = Depends(get_db)):
    # Save connection settings
    if body.connections is not None:
        _save_connections(db, body.connections)

    # Save DB/threshold settings
    if body.db is not None:
        updates: dict = {}
        d = body.db
        if d.detection_infringing_min_age_minutes is not None:
            updates["detection.infringing_min_age_minutes"] = d.detection_infringing_min_age_minutes
        if d.detection_canceled_min_age_minutes is not None:
            updates["detection.canceled_min_age_minutes"] = d.detection_canceled_min_age_minutes
        if d.detection_min_retry_count is not None:
            updates["detection.min_retry_count"] = d.detection_min_retry_count
        if d.scheduler_dry_run is not None:
            updates["scheduler.dry_run"] = d.scheduler_dry_run
        if d.scheduler_enabled is not None:
            updates["scheduler.enabled"] = d.scheduler_enabled
        if d.scheduler_interval_minutes is not None:
            updates["scheduler.interval_minutes"] = d.scheduler_interval_minutes
        if d.notifications_providers is not None:
            updates["notifications.providers"] = d.notifications_providers
        if d.strikes_enabled is not None:
            updates["strikes.enabled"] = d.strikes_enabled
        if d.strikes_infringing_threshold is not None:
            updates["strikes.infringing_threshold"] = d.strikes_infringing_threshold
        if d.strikes_canceled_threshold is not None:
            updates["strikes.canceled_threshold"] = d.strikes_canceled_threshold
        if d.detection_slow_speed_enabled is not None:
            updates["detection.slow_speed_enabled"] = d.detection_slow_speed_enabled
        if d.detection_slow_speed_threshold_kb is not None:
            updates["detection.slow_speed_threshold_kb"] = d.detection_slow_speed_threshold_kb
        if d.detection_slow_speed_min_age_minutes is not None:
            updates["detection.slow_speed_min_age_minutes"] = d.detection_slow_speed_min_age_minutes
        if d.detection_slow_min_completion_pct is not None:
            updates["detection.slow_min_completion_pct"] = d.detection_slow_min_completion_pct
        if d.detection_slow_max_completion_pct is not None:
            updates["detection.slow_max_completion_pct"] = d.detection_slow_max_completion_pct
        if d.strikes_slow_threshold is not None:
            updates["strikes.slow_threshold"] = d.strikes_slow_threshold
        if updates:
            db_config.update_many(db, updates)
            if "scheduler.interval_minutes" in updates:
                from app import scheduler as _sched
                _sched.reschedule(updates["scheduler.interval_minutes"])

    return FullConfigOut(connections=_build_connection_out(db), db=_build_db_out(db))


@router.post("/test-notification/{provider_id}")
def test_notification(provider_id: str, db: Session = Depends(get_db)):
    """Send a test notification to a specific provider by its ID."""
    providers: list = db_config.get(db, "notifications.providers") or []
    provider = next((p for p in providers if p.get("id") == provider_id), None)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    if not provider.get("url", "").strip():
        raise HTTPException(status_code=400, detail="Provider has no URL configured")
    from app.services.notification_service import send
    ok = send(
        title="Unstuckarr — Test notification",
        body=f"This is a test notification from Unstuckarr for provider: {provider.get('name', '?')}",
        url=provider["url"],
    )
    return {"ok": ok}


@router.post("/test-connection")
def test_connections(db: Session = Depends(get_db)):
    results = {}
    for inst in db_config.get_arr_instances_from_db(db):
        arr = ArrService(inst)
        results[inst.name] = arr.health_check()

    from app.adapters.rdt_adapter import RdtAdapter
    rdt_cfg = db_config.get_rdt_config_from_db(db)
    try:
        rdt = RdtAdapter(
            host=rdt_cfg["host"] or None,
            port=rdt_cfg["port"] or None,
            username=rdt_cfg["username"] or None,
            password=rdt_cfg["password"] or None,
        )
        results["RDT-client"] = rdt.health_check()
    except Exception:
        results["RDT-client"] = False

    return results


@router.post("/test-connection/{instance_name}")
def test_one_connection(
    instance_name: str,
    body: ConnectionTestBody = Body(default_factory=ConnectionTestBody),
    db: Session = Depends(get_db),
):
    if instance_name.lower() == "rdt":
        from app.adapters.rdt_adapter import RdtAdapter
        rdt_cfg = db_config.get_rdt_config_from_db(db)
        try:
            rdt = RdtAdapter(
                host=body.host or rdt_cfg["host"] or None,
                port=body.port or rdt_cfg["port"] or None,
                username=body.username or rdt_cfg["username"] or None,
                password=body.password or rdt_cfg["password"] or None,
            )
            return {"ok": rdt.health_check()}
        except Exception:
            return {"ok": False}

    for inst in db_config.get_arr_instances_from_db(db):
        if inst.name.lower() == instance_name.lower():
            # If caller provided override values, test with those instead of DB values.
            # This lets the UI test credentials before the user has saved them.
            if body.host or body.port is not None or body.api_key:
                test_host = body.host or inst.host
                test_port = body.port if body.port is not None else inst.port
                test_key  = body.api_key or inst.api_key
                try:
                    resp = httpx.get(
                        f"http://{test_host}:{test_port}/api/v3/system/status",
                        headers={"X-Api-Key": test_key or ""},
                        timeout=15.0,
                    )
                    return {"ok": resp.status_code == 200}
                except Exception:
                    return {"ok": False}
            return {"ok": ArrService(inst).health_check()}

    raise HTTPException(status_code=404, detail="Instance not found")
