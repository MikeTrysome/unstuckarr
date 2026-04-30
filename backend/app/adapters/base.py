from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from pydantic import BaseModel


class TorrentInfo(BaseModel):
    hash: str
    status: str
    error: str | None = None
    added_at: datetime | None = None
    completed_at: datetime | None = None  # set by RDT-client after download + unpack finish
    retry_count: int = 0
    speed_bytes: int | None = None
    rdt_id: str | None = None
    raw: dict = {}


class DownloadClientAdapter(ABC):
    @abstractmethod
    def get_torrents(self) -> list[TorrentInfo]: ...

    @abstractmethod
    def has_permanent_error(self, torrent: TorrentInfo) -> tuple[bool, str]: ...

    @abstractmethod
    def build_hash_index(self, torrents: list[TorrentInfo]) -> dict[str, TorrentInfo]: ...

    @abstractmethod
    def health_check(self) -> bool: ...
