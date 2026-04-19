"""
Orchestrator: ties together RDT adapter, ARR service, detection, and DB.
Runs synchronously (called from APScheduler thread or a background executor).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.adapters.rdt_adapter import RdtAdapter
from app.database import SessionLocal
from app.models.event import CleanupEvent
from app.models.run import SchedulerRun
from app.models.strike import DownloadStrike
from app.services import db_config
from app.services.arr_service import ArrService
from app.services.detection import (
    DetectionConfig,
    find_stuck_items,
    is_below_speed_threshold,
)
from app.services.log_broadcaster import broadcaster


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _log(level: str, msg: str, run_id: str | None = None):
    broadcaster.emit_sync(level, msg, run_id=run_id)


def _increment_strike(db: Session, download_hash: str, instance_name: str, error_type: str) -> int:
    """Increment (or create) the strike counter for a download. Returns new count."""
    strike = db.query(DownloadStrike).filter_by(
        download_hash=download_hash, instance_name=instance_name
    ).first()
    if strike is None:
        strike = DownloadStrike(
            download_hash=download_hash,
            instance_name=instance_name,
            error_type=error_type,
            strike_count=1,
        )
        db.add(strike)
    else:
        strike.strike_count += 1
        strike.last_seen_at = _utcnow()
        strike.error_type = error_type
    db.commit()
    return strike.strike_count


def _delete_strike(db: Session, download_hash: str, instance_name: str) -> None:
    """Remove strike record after a successful removal."""
    db.query(DownloadStrike).filter_by(
        download_hash=download_hash, instance_name=instance_name
    ).delete()
    db.commit()


def _get_strike_threshold(db: Session, error_type: str) -> int:
    if error_type == "infringing_file":
        return db_config.get(db, "strikes.infringing_threshold")
    if error_type == "slow_download":
        return db_config.get(db, "strikes.slow_threshold")
    return db_config.get(db, "strikes.canceled_threshold")


def _build_detection_config(db: Session) -> DetectionConfig:
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


def _auto_clear_recovered_slow_strikes(
    db: Session,
    rdt_index: dict,
    config: DetectionConfig,
    run_id: str,
) -> None:
    """Clear slow-download strikes for items whose speed has recovered above threshold."""
    slow_strikes = db.query(DownloadStrike).filter_by(error_type="slow_download").all()
    if not slow_strikes:
        return
    cleared = 0
    for strike in slow_strikes:
        rdt = rdt_index.get(strike.download_hash)
        if rdt is None:
            continue  # Not in RDT index — leave strike, will expire naturally
        if not is_below_speed_threshold(rdt, config.slow_speed_threshold_kb):
            db.delete(strike)
            cleared += 1
    if cleared:
        db.commit()
        _log("INFO", f"Cleared strikes for {cleared} slow download(s) that recovered above threshold", run_id=run_id)


def run_cleanup(dry_run: bool | None = None, triggered_by: str = "scheduler") -> str:
    """
    Execute one full cleanup run. Returns run_id.
    This is a synchronous function — safe to call from a thread.
    """
    run_id = str(uuid.uuid4())
    db = SessionLocal()

    try:
        # Resolve dry_run: explicit arg > DB config
        if dry_run is None:
            dry_run = db_config.get(db, "scheduler.dry_run")

        # Check if scheduler is globally disabled
        if not db_config.get(db, "scheduler.enabled") and triggered_by == "scheduler":
            _log("INFO", "Scheduler is disabled, skipping run.", run_id=run_id)
            return run_id

        run = SchedulerRun(
            run_id=run_id,
            started_at=_utcnow(),
            dry_run=dry_run,
            status="running",
        )
        db.add(run)
        db.commit()

        _log("INFO", f"{'[DRY-RUN] ' if dry_run else ''}Cleanup started (run_id={run_id})", run_id=run_id)

        detection_cfg = _build_detection_config(db)
        strikes_enabled = db_config.get(db, "strikes.enabled")
        total_checked = 0
        total_stuck = 0
        total_removed = 0
        total_would_remove = 0

        # Fetch RDT torrents once for all ARR instances
        rdt_index: dict = {}
        rdt_adapter: RdtAdapter | None = None
        rdt_cfg = db_config.get_rdt_config_from_db(db)
        use_rdt = rdt_cfg["enabled"]
        if use_rdt:
            _log("INFO", "Fetching RDT-client torrents...", run_id=run_id)
            try:
                rdt_adapter = RdtAdapter(
                    host=rdt_cfg["host"] or None,
                    port=rdt_cfg["port"] or None,
                    username=rdt_cfg["username"] or None,
                    password=rdt_cfg["password"] or None,
                )
                rdt_torrents = rdt_adapter.get_torrents()
                rdt_index = rdt_adapter.build_hash_index(rdt_torrents)
                _log("INFO", f"{len(rdt_torrents)} torrents fetched, {len(rdt_index)} indexed", run_id=run_id)
            except Exception as exc:
                _log("WARN", f"RDT-client fetch failed: {exc} — cross-check skipped", run_id=run_id)
                use_rdt = False
                rdt_adapter = None

        # Auto-clear slow strikes for downloads that have recovered
        if not dry_run and detection_cfg.slow_speed_enabled and rdt_index:
            _auto_clear_recovered_slow_strikes(db, rdt_index, detection_cfg, run_id)

        for instance in db_config.get_arr_instances_from_db(db):
            if not instance.enabled:
                continue

            _log("INFO", f"--- {instance.name} ({instance.host}:{instance.port}) ---", run_id=run_id)
            arr = ArrService(instance)

            try:
                records = arr.fetch_queue()
            except Exception as exc:
                _log("ERROR", f"Queue fetch failed: {exc}", run_id=run_id)
                continue

            total_checked += len(records)
            _log("INFO", f"{len(records)} items in queue", run_id=run_id)

            stuck_items = find_stuck_items(records, rdt_index, use_rdt, detection_cfg)
            total_stuck += len(stuck_items)

            if not stuck_items:
                _log("INFO", "No stuck items found.", run_id=run_id)
                continue

            _log("INFO", f"{len(stuck_items)} stuck item(s) found", run_id=run_id)

            for stuck in stuck_items:
                arr_item = stuck.arr_item
                item_id = arr_item.get("id")
                title = arr_item.get("title", "?")
                hash_ = str(arr_item.get("downloadId", "?"))[:16]

                download_hash = (arr_item.get("downloadId") or "").lower() or None

                _log(
                    "INFO",
                    f"→ '{title[:60]}' | id={item_id} | hash={hash_}... | error={stuck.error_type!r}",
                    run_id=run_id,
                )

                action = "dry_run" if dry_run else "removed"
                search_type = None

                # ── Strike logic ──────────────────────────────────────────────
                skip_removal = False
                if strikes_enabled and not dry_run and download_hash:
                    strike_count = _increment_strike(db, download_hash, instance.name, stuck.error_type)
                    threshold = _get_strike_threshold(db, stuck.error_type)
                    if strike_count < threshold:
                        _log(
                            "INFO",
                            f"Strike {strike_count}/{threshold} — threshold not reached, skipping removal",
                            run_id=run_id,
                        )
                        action = "strike"
                        skip_removal = True
                    else:
                        _log(
                            "INFO",
                            f"Strike threshold reached ({strike_count}/{threshold}) — removing",
                            run_id=run_id,
                        )

                # ── Soft retry for task_canceled (on each pre-threshold strike) ──
                if (
                    skip_removal
                    and stuck.error_type == "task_canceled"
                    and rdt_adapter is not None
                    and stuck.rdt_torrent is not None
                    and stuck.rdt_torrent.rdt_id is not None
                ):
                    try:
                        ok = rdt_adapter.retry_torrent(stuck.rdt_torrent.rdt_id)
                        if ok:
                            _log("INFO", f"Soft retry triggered via RDT for '{title[:60]}'", run_id=run_id)
                            action = "retried"
                        else:
                            _log("WARN", f"Soft retry returned non-OK for '{title[:60]}'", run_id=run_id)
                    except Exception as exc:
                        _log("WARN", f"Soft retry failed: {exc}", run_id=run_id)

                if not skip_removal and not dry_run and item_id:
                    try:
                        arr.delete_queue_item(item_id)
                        total_removed += 1
                        _log("INFO", f"Removed: {instance.name} item {item_id}", run_id=run_id)
                        if download_hash:
                            _delete_strike(db, download_hash, instance.name)
                    except Exception as exc:
                        _log("ERROR", f"Remove failed: {exc}", run_id=run_id)
                        action = "error"
                elif dry_run:
                    total_would_remove += 1

                try:
                    event = CleanupEvent(
                        timestamp=_utcnow(),
                        instance_name=instance.name,
                        arr_queue_id=item_id,
                        title=title,
                        download_hash=download_hash,
                        error_type=stuck.error_type,
                        error_message=stuck.error_message,
                        action=action,
                        search_type=search_type,
                        dry_run=dry_run,
                        triggered_by=triggered_by,
                        run_id=run_id,
                    )
                    db.add(event)
                    db.commit()
                except Exception as exc:
                    _log("ERROR", f"Failed to persist event for '{title[:60]}': {exc}", run_id=run_id)
                    db.rollback()

        reported_removed = total_would_remove if dry_run else total_removed
        run.finished_at = _utcnow()
        run.total_checked = total_checked
        run.total_stuck = total_stuck
        run.total_removed = reported_removed
        run.status = "success"
        db.commit()

        removed_label = "would remove" if dry_run else "removed"
        summary = (
            f"{'DRY-RUN ' if dry_run else ''}Completed — "
            f"{total_stuck} stuck found, {reported_removed} {removed_label}"
        )
        _log("INFO", summary, run_id=run_id)
        return run_id

    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        try:
            run = db.get(SchedulerRun, run_id) or db.query(SchedulerRun).filter_by(run_id=run_id).first()
            if run:
                run.finished_at = _utcnow()
                run.status = "error"
                run.error_message = str(exc)
                db.commit()
        except Exception:
            pass
        _log("ERROR", f"Cleanup error: {exc}", run_id=run_id)
        raise

    finally:
        db.close()
