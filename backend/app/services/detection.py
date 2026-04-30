"""
Pure detection functions — no side effects, no logging, no DB, no HTTP.
All inputs come in, decisions come out. Fully unit-testable.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.adapters.base import TorrentInfo


@dataclass
class DetectionConfig:
    infringing_min_age_minutes: int = 15
    canceled_min_age_minutes: int = 30
    min_retry_count: int = 1
    error_patterns: tuple[str, ...] = (
        "infringing file",
        "a task was canceled",
        "could not add to provider",
    )
    slow_speed_enabled: bool = False
    slow_speed_threshold_kb: int = 500
    slow_speed_min_age_minutes: int = 10
    slow_min_completion_pct: int = 0
    slow_max_completion_pct: int = 95
    import_pending_min_age_minutes: int = 0  # unused when strikes enabled — threshold=2 provides the delay


@dataclass
class StuckItem:
    arr_item: dict
    rdt_torrent: "TorrentInfo | None"
    error_type: str
    error_message: str


def is_stuck_in_arr(item: dict) -> bool:
    """Item meets the ARR-side stuck criteria (warning status with active download)."""
    return (
        item.get("status") == "warning"
        and item.get("trackedDownloadState") == "downloading"
        and not item.get("statusMessages")
        and item.get("protocol") == "torrent"
    )


def is_import_pending_stuck(item: dict) -> bool:
    """Download completed but no files eligible for import.

    Covers: 0-byte RD deliveries, failed unpacks, files in unexpected subdirectories.
    Unlike error-based detection, this does NOT require an RDT error — the ARR state alone
    is sufficient. Sonarr never auto-retries importPending items; Unstuckarr must break the loop.
    """
    if not (
        item.get("status") == "completed"
        and item.get("trackedDownloadState") == "importPending"
        and item.get("trackedDownloadStatus") == "warning"
        and item.get("protocol") == "torrent"
    ):
        return False
    for sm in item.get("statusMessages") or []:
        for msg in sm.get("messages") or []:
            if "no files found are eligible for import" in msg.lower():
                return True
    return False


def _arr_age_minutes(
    item: dict,
    now: datetime.datetime | None = None,
) -> float:
    """Return age in minutes based on the ARR queue item's 'added' timestamp."""
    added_str = item.get("added")
    if not added_str:
        return float("inf")
    now = now or datetime.datetime.now(datetime.timezone.utc)
    try:
        added = datetime.datetime.fromisoformat(added_str.replace("Z", "+00:00"))
        if added.tzinfo is None:
            added = added.replace(tzinfo=datetime.timezone.utc)
        return (now - added).total_seconds() / 60
    except (ValueError, TypeError):
        return float("inf")


def is_slow_arr_item(item: dict) -> bool:
    """Item is an active download (not in error/warning state) — candidate for speed check."""
    return (
        item.get("status") == "downloading"
        and item.get("trackedDownloadState") == "downloading"
        and item.get("protocol") == "torrent"
    )


def classify_error(error: str) -> str:
    error_lower = error.lower()
    if "infringing" in error_lower:
        return "infringing_file"
    if "task was canceled" in error_lower:
        return "task_canceled"
    return "other"


def _age_minutes(
    torrent: "TorrentInfo",
    now: datetime.datetime | None = None,
) -> float:
    if torrent.added_at is None:
        return float("inf")
    now = now or datetime.datetime.now(datetime.timezone.utc)
    added = torrent.added_at
    if added.tzinfo is None:
        added = added.replace(tzinfo=datetime.timezone.utc)
    return (now - added).total_seconds() / 60


def passes_age_check(
    torrent: "TorrentInfo",
    error_type: str,
    config: DetectionConfig,
    now: datetime.datetime | None = None,
) -> bool:
    """Returns True if the torrent is old enough to act on (error-based detection)."""
    min_age = (
        config.infringing_min_age_minutes
        if error_type == "infringing_file"
        else config.canceled_min_age_minutes
    )
    return _age_minutes(torrent, now) >= min_age


def passes_slow_age_check(
    torrent: "TorrentInfo",
    config: DetectionConfig,
    now: datetime.datetime | None = None,
) -> bool:
    """Returns True if the torrent is old enough for slow-speed detection."""
    return _age_minutes(torrent, now) >= config.slow_speed_min_age_minutes


def passes_retry_check(torrent: "TorrentInfo", config: DetectionConfig) -> bool:
    return torrent.retry_count >= config.min_retry_count


def get_completion_pct(arr_item: dict) -> float:
    """Returns download completion percentage (0–100) from ARR queue item."""
    size = arr_item.get("size") or 0
    sizeleft = arr_item.get("sizeleft") or 0
    if size <= 0:
        return 0.0
    return (1 - sizeleft / size) * 100


def is_below_speed_threshold(torrent: "TorrentInfo", threshold_kb: int) -> bool:
    """Returns True if the torrent's speed is known and below the threshold.
    None means RDT isn't reporting speed (e.g. torrent already downloaded from seeders,
    file transfer phase) — skip these to avoid false positives."""
    if torrent.speed_bytes is None:
        return False
    return torrent.speed_bytes < (threshold_kb * 1024)


def find_stuck_items(
    arr_records: list[dict],
    rdt_index: dict[str, "TorrentInfo"],
    use_rdt_crosscheck: bool,
    config: DetectionConfig,
) -> list[StuckItem]:
    """
    Return list of confirmed stuck and slow items.
    Conservative: skip if ARR-only warning but no RDT error (when crosscheck enabled).
    """
    results: list[StuckItem] = []

    # ── Error-based detection (infringing, task_canceled, other) ─────────────
    for item in arr_records:
        if not is_stuck_in_arr(item):
            continue

        download_id = (item.get("downloadId") or "").lower()

        if not use_rdt_crosscheck or not rdt_index:
            results.append(StuckItem(
                arr_item=item,
                rdt_torrent=None,
                error_type="arr_only",
                error_message="arr-only detection",
            ))
            continue

        rdt_torrent = rdt_index.get(download_id)
        if rdt_torrent is None:
            continue  # Hash not in RDT → skip (conservative)

        if not rdt_torrent.error:
            continue  # ARR warning but no RDT error → skip

        error_type = classify_error(rdt_torrent.error)

        if not passes_age_check(rdt_torrent, error_type, config):
            continue

        if not passes_retry_check(rdt_torrent, config):
            continue

        results.append(StuckItem(
            arr_item=item,
            rdt_torrent=rdt_torrent,
            error_type=error_type,
            error_message=rdt_torrent.error,
        ))

    # ── Import-pending / no eligible files detection ─────────────────────────
    for item in arr_records:
        if not is_import_pending_stuck(item):
            continue

        download_id = (item.get("downloadId") or "").lower()
        rdt_torrent = rdt_index.get(download_id) if rdt_index else None

        # If RDT knows this torrent but completed_at is None, the download/unpack
        # is still in progress on the RDT side — skip to avoid acting too early.
        # (completed_at is set by RDT-client only after both download AND unpack finish.)
        if rdt_torrent is not None and rdt_torrent.completed_at is None:
            continue

        # No age check here — timing is handled by the strike system (threshold=2).
        # Strike 1 timestamp = first detection of importPending state.
        # Strike 2 = item was still stuck after one full run interval (~10 min) → remove.

        # Extract the status message for logging
        error_msg = next(
            (
                m
                for sm in (item.get("statusMessages") or [])
                for m in (sm.get("messages") or [])
                if "no files found" in m.lower()
            ),
            "No files found eligible for import",
        )

        results.append(StuckItem(
            arr_item=item,
            rdt_torrent=rdt_torrent,
            error_type="import_pending",
            error_message=error_msg,
        ))

    # ── Slow-speed detection ──────────────────────────────────────────────────
    if config.slow_speed_enabled and config.slow_speed_threshold_kb > 0 and rdt_index:
        for item in arr_records:
            if not is_slow_arr_item(item):
                continue

            download_id = (item.get("downloadId") or "").lower()
            rdt_torrent = rdt_index.get(download_id)
            if rdt_torrent is None:
                continue

            if not passes_slow_age_check(rdt_torrent, config):
                continue

            if not is_below_speed_threshold(rdt_torrent, config.slow_speed_threshold_kb):
                continue

            completion = get_completion_pct(item)
            if not (config.slow_min_completion_pct <= completion <= config.slow_max_completion_pct):
                continue

            speed_kb = (rdt_torrent.speed_bytes or 0) // 1024
            results.append(StuckItem(
                arr_item=item,
                rdt_torrent=rdt_torrent,
                error_type="slow_download",
                error_message=f"{speed_kb} KB/s (threshold: {config.slow_speed_threshold_kb} KB/s)",
            ))

    return results
