import uuid
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from . import config


class JobStatus(StrEnum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"
    CANCELLED = "cancelled"


TERMINAL = {JobStatus.DONE, JobStatus.ERROR, JobStatus.CANCELLED}
ACTIVE = {JobStatus.QUEUED, JobStatus.DOWNLOADING, JobStatus.TRANSCRIBING, JobStatus.PROCESSING}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    """SQLite hands back naive datetimes even for timezone=True columns; they're UTC, so say so."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def to_dict(self) -> dict:
        return {"id": self.id, "email": self.email, "created_at": iso(self.created_at)}


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # set for paste-a-link jobs
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    cancel_requested: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    has_audio: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)  # outputs/<id>/audio.m4a exists
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.QUEUED, index=True)
    stage: Mapped[str | None] = mapped_column(String(255), nullable=True)  # human-readable progress detail
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict:
        return {
            "job_id": self.id,
            "filename": self.filename,
            "source_url": self.source_url,
            "status": self.status,
            "stage": self.stage,
            "error": self.error,
            "topic": self.topic,
            "has_audio": bool(self.has_audio),
            "cancel_requested": bool(self.cancel_requested),
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }


_engine = None
_SessionLocal = None


def init_db(url: str = config.DATABASE_URL):
    global _engine, _SessionLocal
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    _engine = create_engine(url, connect_args=connect_args)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    Base.metadata.create_all(_engine)
    _migrate(_engine)
    return _engine


def _migrate(engine):
    """create_all() never adds columns to an existing table; add any the model has gained."""
    existing = {c["name"] for c in inspect(engine).get_columns("jobs")}
    with engine.begin() as conn:
        for col in Job.__table__.columns:
            if col.name not in existing:
                conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"))


def get_session() -> Session:
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()
