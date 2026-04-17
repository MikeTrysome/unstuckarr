from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_auth
from app.config import get_settings
from app.database import get_db
from app.schemas.config import DbConfigIn, DbConfigOut, EnvConfigOut, FullConfigOut
from app.services import db_config
from app.services.arr_service import ArrService

router = APIRouter(prefix="/config", tags=["config"], dependencies=[Depends(require_auth)])


def _build_env_out() -> EnvConfigOut:
    s = get_settings()
    return EnvConfigOut(
        sonarr_host=s.sonarr_host,
        sonarr_port=s.sonarr_port,
        sonarr_api_key_set=bool(s.sonarr_api_key),
        sonarr_enabled=s.sonarr_enabled,
        sonarr4k_host=s.sonarr4k_host,
        sonarr4k_port=s.sonarr4k_port,
        sonarr4k_api_key_set=bool(s.sonarr4k_api_key),
        sonarr4k_enabled=s.sonarr4k_enabled,
        radarr_host=s.radarr_host,
        radarr_port=s.radarr_port,
        radarr_api_key_set=bool(s.radarr_api_key),
        radarr_enabled=s.radarr_enabled,
        radarr4k_host=s.radarr4k_host,
        radarr4k_port=s.radarr4k_port,
        radarr4k_api_key_set=bool(s.radarr4k_api_key),
        radarr4k_enabled=s.radarr4k_enabled,
        rdt_host=s.rdt_host,
        rdt_port=s.rdt_port,
        rdt_username_set=bool(s.rdt_username),
        rdt_password_set=bool(s.rdt_password),
        rdt_enabled=s.rdt_enabled,
        interval_minutes=s.interval_minutes,
    )


def _build_db_out(db: Session) -> DbConfigOut:
    cfg = db_config.get_all(db)
    return DbConfigOut(
        detection_infringing_min_age_minutes=cfg["detection.infringing_min_age_minutes"],
        detection_canceled_min_age_minutes=cfg["detection.canceled_min_age_minutes"],
        detection_min_retry_count=cfg["detection.min_retry_count"],
        scheduler_dry_run=cfg["scheduler.dry_run"],
        scheduler_enabled=cfg["scheduler.enabled"],
        notifications_apprise_urls=cfg["notifications.apprise_urls"],
    )


@router.get("", response_model=FullConfigOut)
def get_config(db: Session = Depends(get_db)):
    return FullConfigOut(env=_build_env_out(), db=_build_db_out(db))


@router.put("", response_model=DbConfigOut)
def update_config(body: DbConfigIn, db: Session = Depends(get_db)):
    updates: dict = {}
    if body.detection_infringing_min_age_minutes is not None:
        updates["detection.infringing_min_age_minutes"] = body.detection_infringing_min_age_minutes
    if body.detection_canceled_min_age_minutes is not None:
        updates["detection.canceled_min_age_minutes"] = body.detection_canceled_min_age_minutes
    if body.detection_min_retry_count is not None:
        updates["detection.min_retry_count"] = body.detection_min_retry_count
    if body.scheduler_dry_run is not None:
        updates["scheduler.dry_run"] = body.scheduler_dry_run
    if body.scheduler_enabled is not None:
        updates["scheduler.enabled"] = body.scheduler_enabled
    if body.notifications_apprise_urls is not None:
        updates["notifications.apprise_urls"] = body.notifications_apprise_urls

    if updates:
        db_config.update_many(db, updates)

    return _build_db_out(db)


@router.post("/test-connection")
def test_connections():
    results = {}
    for inst in get_settings().get_arr_instances():
        arr = ArrService(inst)
        results[inst.name] = arr.health_check()

    from app.adapters.rdt_adapter import RdtAdapter
    try:
        rdt = RdtAdapter()
        results["RDT-client"] = rdt.health_check()
    except Exception:
        results["RDT-client"] = False

    return results


@router.post("/test-connection/{instance_name}")
def test_one_connection(instance_name: str):
    if instance_name.lower() == "rdt":
        from app.adapters.rdt_adapter import RdtAdapter
        try:
            return {"ok": RdtAdapter().health_check()}
        except Exception:
            return {"ok": False}

    for inst in get_settings().get_arr_instances():
        if inst.name.lower() == instance_name.lower():
            return {"ok": ArrService(inst).health_check()}

    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Instance not found")
