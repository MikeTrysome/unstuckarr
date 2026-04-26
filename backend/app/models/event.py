from datetime import datetime, timezone
from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base, UTCDateTime


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CleanupEvent(Base):
    __tablename__ = "cleanup_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)
    instance_name: Mapped[str] = mapped_column(String(32), nullable=False)
    arr_queue_id: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    download_hash: Mapped[str | None] = mapped_column(String(64))
    error_type: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    search_type: Mapped[str | None] = mapped_column(String(32))
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    triggered_by: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduler")
    run_id: Mapped[str | None] = mapped_column(String(36))

    __table_args__ = (
        Index("ix_cleanup_events_timestamp", "timestamp"),
        Index("ix_cleanup_events_run_id", "run_id"),
        Index("ix_cleanup_events_instance_name", "instance_name"),
    )
