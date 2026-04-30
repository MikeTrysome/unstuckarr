---
description: Complete reference for all Unstuckarr detection scenarios — ARR states, RDT states, error messages, thresholds, and resolution logic
---

# Unstuckarr Detection Scenarios

All detection logic lives in `backend/app/services/detection.py` (pure, side-effect-free).
Orchestration (strikes, DB, removal) lives in `backend/app/services/cleanup_service.py`.
Configuration defaults live in `backend/app/services/db_config.py` under `DEFAULTS`.

---

## Stack overview

```
Sonarr/Radarr (ARR)  →  queue items with status/trackedDownloadState/statusMessages
        ↓
RDT-client (qBittorrent-compatible API)  →  torrents with rdStatus/error/retryCount
        ↓
Real-Debrid  →  actual cloud download provider
```

When RDT-client reports a torrent to ARR via qBittorrent API:
- **Cached in RD**: instantaneous, downloads from RD's HTTP servers to host
- **Not cached in RD**: RD tries to download via its own P2P infrastructure — slow, may stall
- P2P traffic never reaches the Unraid host directly; RDT-client only uses RD's HTTP servers

---

## Detection scenario 1 — Error: infringing file

**Trigger in stack:** Real-Debrid refuses download because the content is flagged as infringing.

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"warning"` |
| ARR | `trackedDownloadState` | `"downloading"` |
| ARR | `statusMessages` | `[]` (empty) |
| ARR | `protocol` | `"torrent"` |
| RDT | `error` | contains `"infringing file"` |

**Detection function:** `is_stuck_in_arr()` + `classify_error()` → `"infringing_file"`

**Config keys:**
- `detection.infringing_min_age_minutes` (default: 15)
- `strikes.infringing_threshold` (default: 1 — remove on first strike)
- `detection.min_retry_count` (default: 1 — must have been retried at least once)

**Resolution:** Remove from ARR queue + blocklist → ARR triggers `autoRedownloadFailed` → searches next release.

**Notes:** Permanent error, no recovery possible. Threshold 1 = remove immediately.

---

## Detection scenario 2 — Error: task canceled

**Trigger in stack:** RD task was canceled, often due to RD overload or temporary unavailability. Can be transient.

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"warning"` |
| ARR | `trackedDownloadState` | `"downloading"` |
| ARR | `statusMessages` | `[]` (empty) |
| ARR | `protocol` | `"torrent"` |
| RDT | `error` | contains `"a task was canceled"` |

**Detection function:** `is_stuck_in_arr()` + `classify_error()` → `"task_canceled"`

**Config keys:**
- `detection.canceled_min_age_minutes` (default: 30)
- `strikes.canceled_threshold` (default: 3 — wait for 3 strikes before removing)
- `detection.min_retry_count` (default: 1)

**Soft retry:** On each strike below threshold, Unstuckarr calls `rdt_adapter.retry_torrent()` to soft-retry via RDT before giving up. Action logged as `"retried"`.

**Resolution:** After threshold strikes: remove + blocklist → ARR searches next release.

**Notes:** Higher threshold than infringing because this can self-resolve on RD recovery.

---

## Detection scenario 3 — Error: other (Debrid error, etc.)

**Trigger in stack:** RDT reports a non-standard error (e.g., `"Debrid error: error."`, `"could not add to provider"`).

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"warning"` |
| ARR | `trackedDownloadState` | `"downloading"` |
| ARR | `statusMessages` | `[]` (empty) |
| ARR | `protocol` | `"torrent"` |
| RDT | `error` | non-empty, doesn't match infringing/canceled patterns |

**Detection function:** `is_stuck_in_arr()` + `classify_error()` → `"other"`

**Config keys:** Same as `task_canceled` (uses `strikes.canceled_threshold`)

**Resolution:** Remove + blocklist after threshold strikes.

---

## Detection scenario 4 — Slow download

**Trigger in stack:** Download is active but speed is below configured threshold for too long.

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"downloading"` (NOT warning) |
| ARR | `trackedDownloadState` | `"downloading"` |
| ARR | `protocol` | `"torrent"` |
| RDT | `speed_bytes` | non-None AND below threshold |

**Detection function:** `is_slow_arr_item()` + `is_below_speed_threshold()`

**Config keys:**
- `detection.slow_speed_enabled` (default: False — must be explicitly enabled)
- `detection.slow_speed_threshold_kb` (default: 500 KB/s)
- `detection.slow_speed_min_age_minutes` (default: 10)
- `detection.slow_min_completion_pct` (default: 0)
- `detection.slow_max_completion_pct` (default: 95 — don't remove near-complete downloads)
- `strikes.slow_threshold` (default: 3)

**Auto-recovery:** Strikes are cleared automatically if speed recovers above threshold between runs.

**Note on `speed_bytes is None`:** RDT doesn't report speed during the file transfer phase (after RD downloads, while copying to host). `None` is treated as "not slow" to avoid false positives.

---

## Detection scenario 5 — Import pending: no eligible files *(added 2026-04-29)*

**Trigger in stack:** Download reported as complete by RDT-client, but no importable files found on disk. Caused by:
- RD delivering a `.rar` archive that fails to unpack (0 bytes transferred)
- Unpack producing files in unexpected subdirectory
- Download silently writing 0 bytes (`bytesTotal: 0` in RDT download record)
- Any other post-download processing failure

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"completed"` |
| ARR | `trackedDownloadState` | `"importPending"` |
| ARR | `trackedDownloadStatus` | `"warning"` |
| ARR | `statusMessages[].messages` | contains `"No files found are eligible for import in ..."` |
| ARR | `protocol` | `"torrent"` |
| RDT | `downloads[].bytesTotal` | often `0` (symptom, not required for detection) |
| RDT | `rdStatusRaw` | `"downloaded"` (RD side complete, host side failed) |

**Detection function:** `is_import_pending_stuck()`

**Config keys:**
- `detection.import_pending_min_age_minutes` (default: 15) — buffer for slow disk writes
- `strikes.import_pending_threshold` (default: 1 — remove immediately, file presence is deterministic)

**Resolution:** Remove from ARR queue + blocklist → ARR triggers `autoRedownloadFailed` → searches next release. No soft retry (file is either there or it isn't).

**Important:** Sonarr does NOT automatically trigger `autoRedownloadFailed` for items stuck in `importPending`. It keeps retrying the import indefinitely. Unstuckarr is the only mechanism that breaks this loop.

**Real-world example:** CLEMFLIX E10 Kitsune (2026-04-29) — RD delivered as `.rar`, unpack produced 0 bytes, directory empty, Sonarr stuck in importPending.

---

## Known detection gap — Non-cached torrent downloading via RD P2P

**NOT currently detected.** Documented here for future implementation.

**Trigger in stack:** Torrent is not in RD's cache. RD attempts to download it using its own P2P infrastructure (seeders on RD's side). From the host's perspective the download appears active but will likely stall or take extremely long.

| Layer | Property | Value |
|-------|----------|-------|
| ARR | `status` | `"warning"` |
| ARR | `trackedDownloadState` | `"downloading"` |
| ARR | `statusMessages` | `[]` (empty) |
| ARR | `errorMessage` | `"The download is stalled with no connections"` (Sonarr's own detection) |
| ARR | `protocol` | `"torrent"` |
| RDT | `error` | `null` (no error — RD is actively trying) |
| RDT | `rdSeeders` | `> 0` (RD has found seeders on its side) |

**Why missed:** `find_stuck_items` requires `rdt_torrent.error` to be non-null for error-based detection. Slow-speed detection requires `status == "downloading"`, not `"warning"`.

**Real-world example:** CLEMFLIX 271GB DV REMUX season pack (2026-04-29) — not in RD cache, RD downloading via 6 seeders, stalled after ~24GB in 1 hour.

**Suggested fix (not yet implemented):**
```python
def is_seeder_download(arr_item: dict, rdt_torrent) -> bool:
    """ARR warning but RDT has no error and is downloading via seeders — not cached in RD."""
    return (
        is_stuck_in_arr(arr_item)
        and rdt_torrent is not None
        and not rdt_torrent.error
        and (rdt_torrent.rd_seeders or 0) > 0
    )
```
Suggested threshold: 3 strikes, age > 60 minutes.

---

## Strike system summary

| Error type | Threshold | Soft retry |
|------------|-----------|------------|
| `infringing_file` | 1 | No |
| `task_canceled` | 3 | Yes (RDT retry each strike) |
| `other` | 3 | No |
| `slow_download` | 3 | No (auto-clears if speed recovers) |
| `import_pending` | 1 | No |
| `seeder_download` | 3 (proposed) | No |

Each strike = one Unstuckarr run detecting the item. Strikes are per `(download_hash, instance_name)`.
Strikes are cleared on successful removal.

---

## Troubleshooting checklist

**Item stuck in ARR but Unstuckarr not acting:**
1. Check Unstuckarr dashboard → `scheduler_enabled`, `dry_run`, `last_run`
2. Check events for this hash → what action was logged?
3. Check ARR queue item: what is `status` + `trackedDownloadState` + `statusMessages`?
4. Cross-check RDT-client: what is `rdStatus` + `error` for this hash?
5. Determine which scenario applies from table above
6. If none match → likely a detection gap, document and implement

**Unstuckarr ran but found 0 stuck:**
- If item has `status:warning` + `statusMessages:[]`: check RDT `error` field — if null, gap (scenario 6)
- If item has `status:completed` + `trackedDownloadState:importPending`: check age (scenario 5)
- If item is in regular Sonarr AND Sonarr-4K: likely category conflict (should be fixed)

**Item removed but ARR doesn't search again:**
- Verify `autoRedownloadFailed` is True in ARR → Settings → Download Clients
- Check ARR history for the episode — is it blocklisted?
- Check ARR Wanted → Missing to confirm episode is still monitored
