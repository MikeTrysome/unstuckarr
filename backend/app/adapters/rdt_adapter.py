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
    def __init__(self):
        settings = get_settings()
        self._base_url = f"http://{settings.rdt_host}:{settings.rdt_port}"
        self._username = settings.rdt_username
        self._password = settings.rdt_password
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

        retry_count = int(raw.get("retryCount") or raw.get("RetryCount") or 0)

        return TorrentInfo(
            hash=hash_,
            status=str(raw.get("status") or raw.get("Status") or ""),
            error=error if error else None,
            added_at=added_at,
            retry_count=retry_count,
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

    def build_hash_index(self, torrents: list[TorrentInfo]) -> dict[str, TorrentInfo]:
        return {t.hash: t for t in torrents if t.hash}

    def health_check(self) -> bool:
        self._logged_in = False  # Force re-login
        return self._login()
