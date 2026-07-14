"""
Inframe MVP — Database Models (SQLAlchemy ORM)
Implements the three-table data model from mvp-technical-spec §2,
plus an audit_log table for traceability.
"""

from datetime import datetime, date
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Date,
    Text,
    UniqueConstraint,
    CheckConstraint,
    Index,
    ForeignKey,
    event,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from .config import settings

Base = declarative_base()


# ── Person (what a human edits/enrolls) ──
class Person(Base):
    __tablename__ = "person"

    usn = Column(String(15), primary_key=True)  # e.g. '1HK23AI048'
    name = Column(String(100), nullable=True)
    enrolled_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    active = Column(Boolean, nullable=False, default=True)
    consent_given = Column(Boolean, nullable=False, default=False)

    def __repr__(self):
        return f"<Person usn={self.usn!r} name={self.name!r}>"


# ── User (for instructor dashboard auth) ──
class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, default="instructor")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── ClassSession (multi-classroom support) ──
class ClassSession(Base):
    __tablename__ = "class_session"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # e.g., 'CS101'
    camera_id = Column(String(50), nullable=False)
    date = Column(Date, nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<Session {self.name} camera={self.camera_id} active={self.is_active}>"


# ── AttendanceEvent (append-only raw camera detections) ──
class AttendanceEvent(Base):
    __tablename__ = "attendance_event"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("class_session.id"), nullable=False)
    usn = Column(String(15), nullable=False)  # FK to person.usn (soft)
    event_type = Column(String(10), nullable=False)  # ENTRY | SEEN | EXIT
    camera_id = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=True)
    event_time = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('ENTRY', 'SEEN', 'EXIT', 'UNMATCHED')",
            name="ck_event_type",
        ),
        Index("idx_event_usn_time", "usn", "event_time"),
    )

    def __repr__(self):
        return f"<Event {self.event_type} usn={self.usn} @ {self.event_time}>"


# ── Attendance (one row per person per session day — human-readable) ──
class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("class_session.id"), nullable=False)
    usn = Column(String(15), nullable=False)
    check_in_time = Column(DateTime, nullable=True)
    last_seen_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    status = Column(String(15), nullable=False, default="PENDING")
    status_source = Column(String(10), nullable=False, default="AUTO")
    override_reason = Column(String(200), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("usn", "session_id", name="uq_usn_session"),
        CheckConstraint(
            "status IN ('PRESENT', 'ABSENT', 'LEFT_EARLY', 'PENDING', 'LATE', 'NEEDS_REVIEW')",
            name="ck_status",
        ),
        CheckConstraint(
            "status_source IN ('AUTO', 'OVERRIDE')",
            name="ck_status_source",
        ),
    )

    def __repr__(self):
        return f"<Attendance usn={self.usn} session_id={self.session_id} status={self.status}>"


# ── AuditLog (append-only traceability) ──
class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor = Column(String(100), nullable=False, default="system")  # system or user id
    action = Column(String(50), nullable=False)  # e.g. 'EVENT_RECEIVED', 'STATUS_OVERRIDE'
    target_entity = Column(String(50), nullable=True)  # e.g. 'attendance', 'person'
    target_id = Column(String(100), nullable=True)  # e.g. usn or record id
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    details = Column(Text, nullable=True)  # JSON blob for extra context

    def __repr__(self):
        return f"<AuditLog {self.action} by={self.actor} @ {self.timestamp}>"


# ── Engine & Session ──
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables. Safe to call multiple times."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yields a DB session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
