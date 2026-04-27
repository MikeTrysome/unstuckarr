from datetime import datetime

from app.schemas import UtcModel


class IgnoreOut(UtcModel):
    id: int
    download_hash: str
    instance_name: str
    title: str
    expires_at: datetime | None
    created_at: datetime


class IgnoreCreate(UtcModel):
    download_hash: str
    instance_name: str
    title: str
    expires_at: datetime | None = None
