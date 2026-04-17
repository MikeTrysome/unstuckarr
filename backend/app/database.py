from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_db_path


class Base(DeclarativeBase):
    pass


def _make_engine():
    db_path = get_db_path()
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )


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
