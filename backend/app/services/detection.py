"""
Pure detection functions — no side effects, no logging, no DB, no HTTP.
All inputs come in, decisions come out. Fully unit-testable.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
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


@dataclass
class StuckItem:
    arr_item: dict
    rdt_torrent: "TorrentInfo | None"
    error_type: str
    error_message: str


def is_stuck_in_arr(item: dict) -> bool:
    """Item meets the ARR-side stuck criteria."""
    return (
        item.get("status") == "warning"
        and item.get("trackedDownloadState") == "downloading"
        and not item.get("statusMessages")
        and item.get("protocol") == "torrent"
    )


def classify_error(error: str) -> str:
    error_lower = error.lower()
    if "infringing" in error_lower:
        return "infringing_file"
    if "task was canceled" in error_lower:
        return "task_canceled"
    return "other"


def passes_age_check(
    torrent: "TorrentInfo",
    error_type: str,
    config: DetectionConfig,
    now: datetime.datetime | None = None,
) -> bool:
    """Returns True if the torrent is old enough to act on."""
    if torrent.added_at is None:
        return True  # No timestamp → can't check, assume old enough

    now = now or datetime.datetime.now(datetime.timezone.utc)

    # Normalize added_at to UTC-aware
    added = torrent.added_at
    if added.tzinfo is None:
        added = added.replace(tzinfo=datetime.timezone.utc)

    age_minutes = (now - added).total_seconds() / 60

    min_age = (
        config.infringing_min_age_minutes
        if error_type == "infringing_file"
        else config.canceled_min_age_minutes
    )
    return age_minutes >= min_age


def passes_retry_check(torrent: "TorrentInfo", config: DetectionConfig) -> bool:
    return torrent.retry_count >= config.min_retry_count


def find_stuck_items(
    arr_records: list[dict],
    rdt_index: dict[str, "TorrentInfo"],
    use_rdt_crosscheck: bool,
    config: DetectionConfig,
) -> list[StuckItem]:
    """
    Return list of confirmed stuck items.
    Conservative: skip if ARR-only warning but no RDT error (when crosscheck enabled).
    """
    results: list[StuckItem] = []

    for item in arr_records:
        if not is_stuck_in_arr(item):
            continue

        download_id = (item.get("downloadId") or "").lower()

        if not use_rdt_crosscheck or not rdt_index:
            results.append(StuckItem(
                arr_item=item,
                rdt_torrent=None,
                error_type="arr_only",
                error_message="arr-only detectie",
            ))
            continue

        rdt_torrent = rdt_index.get(download_id)
        if rdt_torrent is None:
            continue  # Hash not in RDT → skip (conservative)

        has_error = rdt_torrent.error is not None
        if not has_error:
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

    return results
