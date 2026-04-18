#!/bin/sh
# Fix /data ownership if the bind-mounted directory is owned by root
# (common on Unraid when Docker auto-creates the host path).
# This runs as root before dropping to the app user.
if [ "$(stat -c %u /data)" != "1000" ]; then
    chown -R unstuckarr:unstuckarr /data
fi

exec su-exec unstuckarr uvicorn app.main:app --host 0.0.0.0 --port 7676
