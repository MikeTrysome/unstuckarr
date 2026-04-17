from fastapi import APIRouter, Depends, HTTPException, Query

from app.adapters.rdt_adapter import RdtAdapter
from app.auth import require_auth
from app.config import get_settings
from app.schemas.queue import StuckItemOut
from app.services.arr_service import ArrService
from app.services.db_config import DEFAULTS
from app.services.detection import DetectionConfig, find_stuck_items

router = APIRouter(tags=["queue"], dependencies=[Depends(require_auth)])


def _get_detection_config() -> DetectionConfig:
    # Use defaults when called outside a DB session (queue is live-only)
    return DetectionConfig(
        infringing_min_age_minutes=DEFAULTS["detection.infringing_min_age_minutes"],
        canceled_min_age_minutes=DEFAULTS["detection.canceled_min_age_minutes"],
        min_retry_count=DEFAULTS["detection.min_retry_count"],
    )


@router.get("/queue", response_model=list[StuckItemOut])
def get_stuck_queue(instance: str | None = Query(None, description="Filter by instance name")):
    settings = get_settings()

    rdt_index: dict = {}
    use_rdt = settings.rdt_enabled
    if use_rdt:
        try:
            adapter = RdtAdapter()
            torrents = adapter.get_torrents()
            rdt_index = adapter.build_hash_index(torrents)
        except Exception:
            use_rdt = False

    detection_cfg = _get_detection_config()
    results: list[StuckItemOut] = []

    for inst in settings.get_arr_instances():
        if not inst.enabled:
            continue
        if instance and inst.name.lower() != instance.lower():
            continue

        arr = ArrService(inst)
        try:
            records = arr.fetch_queue()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc))

        stuck = find_stuck_items(records, rdt_index, use_rdt, detection_cfg)
        for s in stuck:
            rdt = s.rdt_torrent
            results.append(StuckItemOut(
                arr_queue_id=s.arr_item.get("id"),
                title=s.arr_item.get("title", "?"),
                instance_name=inst.name,
                download_hash=(s.arr_item.get("downloadId") or "").lower() or None,
                error_type=s.error_type,
                error_message=s.error_message,
                added_at=rdt.added_at if rdt else None,
                retry_count=rdt.retry_count if rdt else 0,
            ))

    return results


@router.get("/queue/rdt-torrents")
def get_rdt_torrents():
    """Raw RDT torrent list for debugging."""
    try:
        adapter = RdtAdapter()
        torrents = adapter.get_torrents()
        return [t.model_dump(exclude={"raw"}) for t in torrents]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
