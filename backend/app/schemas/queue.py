from datetime import datetime

from app.schemas import UtcModel


class StuckItemOut(UtcModel):
    arr_queue_id: int | None
    title: str
    instance_name: str
    download_hash: str | None
    error_type: str
    error_message: str
    added_at: datetime | None
    retry_count: int
    strike_count: int = 0
    strike_threshold: int = 1
    speed_bytes: int | None = None


class RunOut(UtcModel):
    run_id: str
    started_at: datetime
    finished_at: datetime | None
    dry_run: bool
    total_checked: int
    total_stuck: int
    total_removed: int
    status: str
    error_message: str | None


class RunListOut(UtcModel):
    items: list[RunOut]
    total: int
