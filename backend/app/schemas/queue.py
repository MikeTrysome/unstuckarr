from datetime import datetime
from pydantic import BaseModel


class StuckItemOut(BaseModel):
    arr_queue_id: int | None
    title: str
    instance_name: str
    download_hash: str | None
    error_type: str
    error_message: str
    added_at: datetime | None
    retry_count: int


class RunOut(BaseModel):
    run_id: str
    started_at: datetime
    finished_at: datetime | None
    dry_run: bool
    total_checked: int
    total_stuck: int
    total_removed: int
    status: str
    error_message: str | None

    model_config = {"from_attributes": True}


class RunListOut(BaseModel):
    items: list[RunOut]
    total: int
