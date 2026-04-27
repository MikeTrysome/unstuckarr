from datetime import datetime, timezone

from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, UTCDateTime


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DownloadIgnore(Base):
    """
    Prevents Unstuckarr from acting on a specific download hash.
    expires_at=None means permanent ignore.
    """

    __tablename__ = "download_ignores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    download_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    instance_name: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_download_ignores_hash", "download_hash"),
    )
