from datetime import datetime, timezone

from sqlalchemy import Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, UTCDateTime


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DownloadStrike(Base):
    """
    Tracks how many times a stuck download has been seen across cleanup runs.
    Strikes accumulate until the configured threshold is reached, at which
    point the item is removed from ARR. This prevents aggressive removal of
    transient errors that may resolve themselves.
    """

    __tablename__ = "download_strikes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    download_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_name: Mapped[str] = mapped_column(String(32), nullable=False)
    error_type: Mapped[str] = mapped_column(String(64), nullable=False)
    strike_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)

    __table_args__ = (
        UniqueConstraint("download_hash", "instance_name", name="uq_strike_hash_instance"),
        Index("ix_download_strikes_hash", "download_hash"),
    )
