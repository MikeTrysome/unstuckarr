---
name: check-stuck
description: Check current stuck downloads via live ARR and RDT data. Use when the user wants to see what's stuck right now, or to verify what Unstuckarr would act on.
disable-model-invocation: false
allowed-tools: mcp__arr-stack__rdt_get_stuck_torrents, mcp__arr-stack__rdt_get_torrents, mcp__arr-stack__arr_get_queue
---

# Check Current Stuck Downloads

Use the MCP tools to get a live view of what Unstuckarr would detect and act on.

## Steps

1. **Fetch stuck RDT torrents**
   Call `rdt_get_stuck_torrents` to see torrents RDT-client considers failed/stuck.

2. **Fetch full ARR queues** (optional, if cross-reference needed)
   Call `arr_get_queue` for Sonarr and/or Radarr to see what's in the download queue.

3. **Present a clear overview**
   For each stuck item, show:
   - Title (or hash if no title)
   - Error type (`infringing_file` / `task_canceled` / other)
   - How long it's been stuck (added_at → now)
   - Which ARR instance owns it (if matched)
   - What Unstuckarr would do: remove + blocklist + re-search

4. **Summary line**
   e.g. "3 stuck items found: 2 infringing_file (permanent), 1 task_canceled (transient — may resolve on its own)"

## Notes
- `infringing_file` = always permanent, Unstuckarr removes immediately (above min age)
- `task_canceled` = transient, higher threshold before action
- Detection thresholds come from DB config (default: infringing ≥ 5 min, canceled ≥ 30 min, retry ≥ 3)
