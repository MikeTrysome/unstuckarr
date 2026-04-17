from datetime import datetime

from app.schemas import UtcModel


class EventOut(UtcModel):
    id: int
    timestamp: datetime
    instance_name: str
    arr_queue_id: int | None
    title: str
    download_hash: str | None
    error_type: str | None
    error_message: str | None
    action: str
    search_type: str | None
    dry_run: bool
    triggered_by: str
    run_id: str | None


class EventListOut(UtcModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
