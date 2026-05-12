from __future__ import annotations

import datetime
import httpx

from app.adapters.base import DownloadClientAdapter, TorrentInfo
from app.config import get_settings

RDT_ERROR_PATTERNS = [
    "infringing file",
    "a task was canceled",
    "could not add to provider",
]


class RdtAdapter(DownloadClientAdapter):
    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
    ):
        settings = get_settings()
        self._base_url = f"http://{host or settings.rdt_host}:{port or settings.rdt_port}"
        self._username = username or settings.rdt_username
        self._password = password or settings.rdt_password
        self._client: httpx.Client | None = None
        self._logged_in = False

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=15.0)
        return self._client

    def _login(self) -> bool:
        if self._logged_in:
            return True

        client = self._get_client()

        # Primary: native RDT-client API
        try:
            resp = client.post(
                f"{self._base_url}/Api/Authentication/Login",
                json={"username": self._username, "password": self._password},
            )
            if resp.status_code in (200, 204):
                self._logged_in = True
                return True
        except Exception:
            pass

        # Fallback: qBit-compatible login (not used in production but kept as safety net)
        try:
            resp = client.post(
                f"{self._base_url}/auth/login",
                data={"username": self._username, "password": self._password},
            )
            if "Ok." in resp.text or resp.status_code == 200:
                self._logged_in = True
                return True
        except Exception:
            pass

        return False

    def get_torrents(self) -> list[TorrentInfo]:
        if not self._login():
            return []

        client = self._get_client()
        try:
            resp = client.get(f"{self._base_url}/Api/Torrents")
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

        raw_list: list[dict] = data if isinstance(data, list) else data.get("data", data.get("torrents", []))
        return [self._parse_torrent(t) for t in raw_list]

    def _parse_torrent(self, raw: dict) -> TorrentInfo:
        hash_ = (raw.get("hash") or raw.get("Hash") or "").lower()

        # Torrent-level error
        error = raw.get("error") or raw.get("Error") or raw.get("rdError") or None

        # Check download-level errors if no torrent-level error
        if not error:
            for dl in (raw.get("downloads") or raw.get("Downloads") or []):
                dl_err = dl.get("error") or dl.get("Error") or ""
                if dl_err:
                    error = dl_err
                    break

        # Parse added_at
        added_at = None
        raw_added = raw.get("added") or raw.get("Added") or raw.get("addedAt")
        if raw_added:
            try:
                added_at = datetime.datetime.fromisoformat(str(raw_added).replace("Z", "+00:00"))
            except Exception:
                pass

        # Parse completed_at — set by RDT-client after both download and unpack finish
        completed_at = None
        raw_completed = raw.get("completed") or raw.get("Completed")
        if raw_completed:
            try:
                completed_at = datetime.datetime.fromisoformat(str(raw_completed).replace("Z", "+00:00"))
            except Exception:
                pass

        retry_count = int(raw.get("retryCount") or raw.get("RetryCount") or 0)

        raw_torrent_retry = raw.get("torrentRetryAttempts") or raw.get("TorrentRetryAttempts")
        torrent_retry_attempts = int(raw_torrent_retry) if raw_torrent_retry is not None else None

        raw_speed = (
            raw.get("rdSpeed")
            or raw.get("speed")
            or raw.get("Speed")
            or raw.get("downloadSpeed")
            or None
        )
        speed_bytes = int(raw_speed) if raw_speed is not None else None

        rdt_id = str(raw.get("id") or raw.get("Id") or "") or None

        raw_seeders = raw.get("rdSeeders") or raw.get("seeders") or raw.get("Seeders")
        rd_seeders = int(raw_seeders) if raw_seeders is not None else None

        return TorrentInfo(
            hash=hash_,
            status=str(raw.get("status") or raw.get("Status") or ""),
            error=error if error else None,
            added_at=added_at,
            completed_at=completed_at,
            retry_count=retry_count,
            torrent_retry_attempts=torrent_retry_attempts,
            speed_bytes=speed_bytes,
            rd_seeders=rd_seeders,
            rdt_id=rdt_id,
            raw=raw,
        )

    def has_permanent_error(self, torrent: TorrentInfo) -> tuple[bool, str]:
        if not torrent.error:
            return False, ""
        error_lower = torrent.error.lower()
        for pattern in RDT_ERROR_PATTERNS:
            if pattern in error_lower:
                return True, torrent.error
        return False, ""

    def retry_torrent(self, rdt_id: str) -> bool:
        """Ask RDT-client to retry a torrent by its internal ID."""
        if not self._login():
            return False
        client = self._get_client()
        try:
            resp = client.post(f"{self._base_url}/Api/Torrents/{rdt_id}/Retry")
            return resp.status_code in (200, 204)
        except Exception:
            return False

    def build_hash_index(self, torrents: list[TorrentInfo]) -> dict[str, TorrentInfo]:
        return {t.hash: t for t in torrents if t.hash}

    def health_check(self) -> bool:
        self._logged_in = False  # Force re-login
        return self._login()
