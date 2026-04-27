from datetime import datetime, timezone

from sqlalchemy import DateTime, create_engine, event as sa_event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_db_path


class UTCDateTime(TypeDecorator):
    """DateTime column that always returns timezone-aware UTC datetimes.

    SQLite stores datetimes as naive strings. Without this, isoformat() produces
    strings without a timezone suffix, which browsers interpret as local time —
    causing timestamps to appear hours off for non-UTC users.
    """
    impl = DateTime
    cache_ok = True

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    pass


def _make_engine():
    db_path = get_db_path()
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )

    @sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragma(conn, _record):
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")

    return engine


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import event, config, run, strike, ignore  # noqa: F401 – ensures models are registered
    Base.metadata.create_all(bind=engine)
