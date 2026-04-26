from datetime import datetime, timezone
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base, UTCDateTime


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SchedulerRun(Base):
    __tablename__ = "scheduler_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    total_checked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_stuck: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_removed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    error_message: Mapped[str | None] = mapped_column(Text)
