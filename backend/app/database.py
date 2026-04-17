from sqlalchemy import create_engine, event as sa_event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_db_path


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
    from app.models import event, config, run  # noqa: F401 – ensures models are registered
    Base.metadata.create_all(bind=engine)
