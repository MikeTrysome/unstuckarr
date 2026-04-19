"""
Notification service — sends notifications via Apprise per provider/event.
Synchronous; safe to call from the cleanup thread. Errors are logged, never raised.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Available notification events
EVENTS: list[tuple[str, str]] = [
    ("strike",      "Strike (Error)"),
    ("slow_strike", "Strike (Slow)"),
    ("removed",     "Removed"),
    ("retry",       "Retry"),
]
EVENT_KEYS = {key for key, _ in EVENTS}


def send(title: str, body: str, url: str) -> bool:
    """Send a single notification via one Apprise URL. Returns True on success."""
    url = url.strip()
    if not url:
        return False
    try:
        import apprise
        a = apprise.Apprise()
        a.add(url)
        result = a.notify(title=title, body=body)
        return bool(result)
    except Exception as exc:
        logger.warning("Notification failed (%s): %s", url[:40], exc)
        return False


def dispatch(
    event: str,
    title: str,
    body: str,
    providers: list[dict],
) -> None:
    """
    Send notification to all enabled providers that have this event selected.
    Silently skips disabled providers or providers without this event.
    """
    if event not in EVENT_KEYS:
        return
    for provider in providers:
        if not provider.get("enabled", False):
            continue
        if event not in provider.get("events", []):
            continue
        url = provider.get("url", "")
        if not url:
            continue
        ok = send(title=title, body=body, url=url)
        name = provider.get("name", "?")
        if ok:
            logger.debug("Notification sent [%s] event=%s", name, event)
        else:
            logger.warning("Notification failed [%s] event=%s", name, event)
