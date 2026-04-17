from datetime import datetime
from pydantic import BaseModel


class EventOut(BaseModel):
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

    model_config = {"from_attributes": True}


class EventListOut(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
