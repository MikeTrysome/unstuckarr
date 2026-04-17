from __future__ import annotations

import asyncio
import datetime
from typing import Set


class LogBroadcaster:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    def emit_sync(self, level: str, message: str, **context):
        """Thread-safe emit from sync code (APScheduler / cleanup thread)."""
        if not self._loop or not self._loop.is_running():
            return
        msg = self._build_msg(level, message, **context)
        self._loop.call_soon_threadsafe(self._distribute, msg)

    def _build_msg(self, level: str, message: str, **context) -> dict:
        return {
            "level": level,
            "msg": message,
            "ts": datetime.datetime.utcnow().isoformat(),
            **context,
        }

    def _distribute(self, msg: dict):
        """Run on the event loop thread — distribute to all subscriber queues."""
        dead: Set[asyncio.Queue] = set()
        for q in self._subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                # Drop oldest, add newest
                try:
                    q.get_nowait()
                    q.put_nowait(msg)
                except Exception:
                    dead.add(q)
        self._subscribers -= dead


broadcaster = LogBroadcaster()
