from sqlalchemy import event
import os
from societyops_dependencies.database.patterns import Base, create_standard_sync_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/complaints.db")

engine = create_standard_sync_engine(DATABASE_URL)

# Keep the SQLite specific pragma logic
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

from sqlalchemy.orm import sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=engine)
