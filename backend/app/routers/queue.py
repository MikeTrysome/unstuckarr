from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

_VALID_INSTANCES = {"Sonarr", "Sonarr-4K", "Radarr", "Radarr-4K"}

from datetime import datetime, timezone

from app.adapters.rdt_adapter import RdtAdapter
from app.auth import require_auth
from app.database import get_db
from app.models.ignore import DownloadIgnore
from app.models.strike import DownloadStrike
from app.schemas.queue import MonitoringItemOut, StuckItemOut
from app.services import db_config
from app.services.arr_service import ArrService
from app.services.detection import DetectionConfig, find_stuck_items


def _get_ignored_hashes(db: Session) -> set[str]:
    now = datetime.now(timezone.utc)
    return {
        i.download_hash for i in db.query(DownloadIgnore).all()
        if i.expires_at is None or i.expires_at > now
    }

router = APIRouter(tags=["queue"], dependencies=[Depends(require_auth)])


def _get_detection_config(db) -> DetectionConfig:
    return DetectionConfig(
        infringing_min_age_minutes=db_config.get(db, "detection.infringing_min_age_minutes"),
        canceled_min_age_minutes=db_config.get(db, "detection.canceled_min_age_minutes"),
        min_retry_count=db_config.get(db, "detection.min_retry_count"),
        slow_speed_enabled=db_config.get(db, "detection.slow_speed_enabled"),
        slow_speed_threshold_kb=db_config.get(db, "detection.slow_speed_threshold_kb"),
        slow_speed_min_age_minutes=db_config.get(db, "detection.slow_speed_min_age_minutes"),
        slow_min_completion_pct=db_config.get(db, "detection.slow_min_completion_pct"),
        slow_max_completion_pct=db_config.get(db, "detection.slow_max_completion_pct"),
    )


@router.get("/queue", response_model=list[StuckItemOut])
def get_stuck_queue(
    instance: str | None = Query(None, description="Filter by instance name"),
    db: Session = Depends(get_db),
):
    if instance and instance not in _VALID_INSTANCES:
        raise HTTPException(status_code=400, detail=f"Invalid instance. Valid: {sorted(_VALID_INSTANCES)}")

    rdt_cfg = db_config.get_rdt_config_from_db(db)
    rdt_index: dict = {}
    use_rdt = rdt_cfg["enabled"]
    if use_rdt:
        try:
            adapter = RdtAdapter(
                host=rdt_cfg["host"] or None,
                port=rdt_cfg["port"] or None,
                username=rdt_cfg["username"] or None,
                password=rdt_cfg["password"] or None,
            )
            torrents = adapter.get_torrents()
            rdt_index = adapter.build_hash_index(torrents)
        except Exception:
            use_rdt = False

    detection_cfg = _get_detection_config(db)
    ignored_hashes = _get_ignored_hashes(db)
    results: list[StuckItemOut] = []

    for inst in db_config.get_arr_instances_from_db(db):
        if not inst.enabled:
            continue
        if not inst.host:
            # Instance not configured yet — skip silently
            continue
        if instance and inst.name.lower() != instance.lower():
            continue

        arr = ArrService(inst)
        try:
            records = arr.fetch_queue()
        except Exception:
            # Single instance failure should not block other instances
            continue

        # Resolve strike thresholds once per instance loop
        infringing_threshold = db_config.get(db, "strikes.infringing_threshold")
        canceled_threshold   = db_config.get(db, "strikes.canceled_threshold")
        slow_threshold       = db_config.get(db, "strikes.slow_threshold")

        stuck = find_stuck_items(records, rdt_index, use_rdt, detection_cfg)
        for s in stuck:
            rdt = s.rdt_torrent
            hash_ = (s.arr_item.get("downloadId") or "").lower() or None
            if hash_ and hash_ in ignored_hashes:
                continue

            # Look up current strike count
            strike_count = 0
            if hash_:
                strike_row = db.query(DownloadStrike).filter_by(
                    download_hash=hash_, instance_name=inst.name
                ).first()
                if strike_row:
                    strike_count = strike_row.strike_count

            threshold = (
                infringing_threshold if s.error_type == "infringing_file"
                else slow_threshold if s.error_type == "slow_download"
                else canceled_threshold
            )

            results.append(StuckItemOut(
                arr_queue_id=s.arr_item.get("id"),
                title=s.arr_item.get("title", "?"),
                instance_name=inst.name,
                download_hash=hash_,
                error_type=s.error_type,
                error_message=s.error_message,
                added_at=rdt.added_at if rdt else None,
                retry_count=rdt.retry_count if rdt else 0,
                strike_count=strike_count,
                strike_threshold=threshold,
                speed_bytes=rdt.speed_bytes if rdt else None,
            ))

    return results


@router.get("/queue/monitoring", response_model=list[MonitoringItemOut])
def get_monitoring_queue(
    instance: str | None = Query(None, description="Filter by instance name"),
    db: Session = Depends(get_db),
):
    """
    ARR items with a warning status that haven't been confirmed stuck by RDT yet.
    These are being watched but no action will be taken until RDT also reports an error.
    """
    if instance and instance not in _VALID_INSTANCES:
        raise HTTPException(status_code=400, detail=f"Invalid instance. Valid: {sorted(_VALID_INSTANCES)}")

    rdt_cfg = db_config.get_rdt_config_from_db(db)
    rdt_index: dict = {}
    use_rdt = rdt_cfg["enabled"]
    if use_rdt:
        try:
            adapter = RdtAdapter(
                host=rdt_cfg["host"] or None,
                port=rdt_cfg["port"] or None,
                username=rdt_cfg["username"] or None,
                password=rdt_cfg["password"] or None,
            )
            rdt_index = adapter.build_hash_index(adapter.get_torrents())
        except Exception:
            use_rdt = False

    canceled_threshold = db_config.get(db, "strikes.canceled_threshold")
    ignored_hashes = _get_ignored_hashes(db)
    results: list[MonitoringItemOut] = []

    for inst in db_config.get_arr_instances_from_db(db):
        if not inst.enabled or not inst.host:
            continue
        if instance and inst.name.lower() != instance.lower():
            continue

        arr = ArrService(inst)
        try:
            records = arr.fetch_queue()
        except Exception:
            continue

        for item in records:
            if not (
                item.get("status") == "warning"
                and item.get("trackedDownloadState") == "downloading"
                and not item.get("statusMessages")
                and item.get("protocol") == "torrent"
            ):
                continue

            hash_ = (item.get("downloadId") or "").lower() or None

            if hash_ and hash_ in ignored_hashes:
                continue

            # Skip items already confirmed by RDT — those show in /queue as stuck
            if use_rdt and hash_:
                rdt_torrent = rdt_index.get(hash_)
                if rdt_torrent and rdt_torrent.error:
                    continue

            strike_count = 0
            if hash_:
                strike_row = db.query(DownloadStrike).filter_by(
                    download_hash=hash_, instance_name=inst.name
                ).first()
                if strike_row:
                    strike_count = strike_row.strike_count

            added_raw = item.get("added")
            added_at = None
            if added_raw:
                try:
                    from datetime import datetime, timezone
                    added_at = datetime.fromisoformat(added_raw.replace("Z", "+00:00"))
                except Exception:
                    pass

            results.append(MonitoringItemOut(
                arr_queue_id=item.get("id"),
                title=item.get("title", "?"),
                instance_name=inst.name,
                download_hash=hash_,
                arr_error_message=item.get("errorMessage"),
                added_at=added_at,
                strike_count=strike_count,
                strike_threshold=canceled_threshold,
            ))

    return results


@router.get("/queue/rdt-torrents")
def get_rdt_torrents(db: Session = Depends(get_db)):
    """Raw RDT torrent list for debugging."""
    rdt_cfg = db_config.get_rdt_config_from_db(db)
    try:
        adapter = RdtAdapter(
            host=rdt_cfg["host"] or None,
            port=rdt_cfg["port"] or None,
            username=rdt_cfg["username"] or None,
            password=rdt_cfg["password"] or None,
        )
        torrents = adapter.get_torrents()
        return [t.model_dump(exclude={"raw"}) for t in torrents]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
