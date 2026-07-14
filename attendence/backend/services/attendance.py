"""
Inframe MVP — Attendance Status Resolution Engine

Direct implementation of mvp-technical-spec §5.
The 30-minute rule is a STALENESS CHECK on last_seen_time (§0 reconciliation):
  - gap = event_time - last_seen_time
  - gap ≤ 30 min  → PRESENT
  - gap > 30 min  → ABSENT / LEFT_EARLY
"""

import json
from datetime import datetime, timedelta, date as date_type
from typing import Optional

from sqlalchemy.orm import Session

from ..config import settings
from ..database import Person, AttendanceEvent, Attendance, AuditLog, ClassSession


def get_absent_gap() -> timedelta:
    return timedelta(minutes=settings.ABSENT_GAP_MINUTES)

def get_review_band() -> timedelta:
    return timedelta(minutes=settings.REVIEW_BAND_MINUTES)

ABSENT_GAP = timedelta(minutes=30)
REVIEW_BAND = timedelta(minutes=5)
COOLDOWN = timedelta(seconds=settings.DUPLICATE_EVENT_COOLDOWN_SECONDS)


def handle_event(
    db: Session,
    usn: str,
    event_type: str,
    event_time: datetime,
    camera_id: str,
    confidence: Optional[float] = None,
) -> Optional[Attendance]:
    """
    Process a single recognition event and update the attendance record.
    Returns the updated Attendance record, or None if the person is unknown.
    """
    # Find active session for camera
    active_session = db.query(ClassSession).filter(
        ClassSession.camera_id == camera_id,
        ClassSession.is_active == True
    ).first()

    if not active_session:
        _append_event(db, usn, event_type, camera_id, confidence, event_time, session_id=0) # 0 means no active session
        _audit(db, "system", "EVENT_NO_SESSION", "attendance_event", usn,
               {"reason": "No active session for camera", "camera_id": camera_id})
        return None

    # 1. Validate person exists and is active
    person = db.query(Person).filter(Person.usn == usn, Person.active == True).first()
    if person is None:
        # Log as unmatched — no attendance row created
        _append_event(db, usn, "UNMATCHED", camera_id, confidence, event_time, session_id=active_session.id)
        _audit(db, "system", "UNMATCHED_EVENT", "attendance_event", usn,
               {"reason": "USN not found or inactive", "camera_id": camera_id})
        return None

    # 2. Dedup rapid-fire events
    if event_type == "ENTRY" and _is_duplicate_entry(db, usn, event_time):
        # Convert to SEEN instead of creating noise
        event_type = "SEEN"

    # 3. Append raw event
    _append_event(db, usn, event_type, camera_id, confidence, event_time, session_id=active_session.id)

    # 4. Get or create the daily attendance record
    record = _get_or_create_attendance(db, usn, active_session.id)

    # 5. Apply state transition
    if event_type == "ENTRY":
        if record.check_in_time is None:
            record.check_in_time = event_time
        record.last_seen_time = event_time
        record.status = "PENDING"
        record.status_source = "AUTO"

    elif event_type == "SEEN":
        record.last_seen_time = event_time

    elif event_type == "EXIT":
        record.check_out_time = event_time
        if record.last_seen_time:
            gap = event_time - record.last_seen_time
            record.status = _resolve_status(gap, record.check_in_time is not None)
        else:
            record.status = "ABSENT"
        record.status_source = "AUTO"

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    # 6. Audit log
    _audit(db, "system", "EVENT_PROCESSED", "attendance", str(record.id),
           {"usn": usn, "event_type": event_type, "status": record.status})

    return record


def close_session(db: Session, session_id: int) -> dict:
    """
    End-of-day resolution: resolve all PENDING records for the given session.
    Returns a summary of how many records were resolved and to what status.
    """
    now = datetime.utcnow()
    pending = (
        db.query(Attendance)
        .filter(
            Attendance.session_id == session_id,
            Attendance.status == "PENDING",
        )
        .all()
    )

    statuses: dict[str, int] = {}
    for record in pending:
        if record.last_seen_time:
            gap = now - record.last_seen_time
            record.status = _resolve_status(gap, record.check_in_time is not None)
        else:
            record.status = "ABSENT"
        record.status_source = "AUTO"
        record.updated_at = now
        statuses[record.status] = statuses.get(record.status, 0) + 1

    db.commit()

    # Also mark session inactive
    cs = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if cs:
        cs.is_active = False
        db.commit()

    _audit(db, "system", "SESSION_CLOSED", "session", str(session_id),
           {"records_resolved": len(pending), "statuses": statuses})

    return {"records_resolved": len(pending), "statuses": statuses}


def override_status(
    db: Session,
    usn: str,
    session_id: int,
    new_status: str,
    reason: str,
    actor: str = "instructor",
) -> Optional[Attendance]:
    """
    Instructor manually overrides an attendance status.
    """
    record = (
        db.query(Attendance)
        .filter(Attendance.usn == usn, Attendance.session_id == session_id)
        .first()
    )
    if record is None:
        return None

    old_status = record.status
    record.status = new_status
    record.status_source = "OVERRIDE"
    record.override_reason = reason
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    _audit(db, actor, "STATUS_OVERRIDE", "attendance", str(record.id), {
        "usn": usn,
        "old_status": old_status,
        "new_status": new_status,
        "reason": reason,
    })

    return record


# ── Internal helpers ──

def _resolve_status(gap: timedelta, had_check_in: bool) -> str:
    """
    Core resolution logic from mvp-technical-spec §5:
      gap ≤ 30 min → PRESENT
      gap > 30 min + had check-in → LEFT_EARLY
      gap > 30 min + no check-in  → ABSENT

    Plus the review-band rule from PRD §8.2:
      gap within ±5 min of threshold → NEEDS_REVIEW
    """
    lower = ABSENT_GAP - REVIEW_BAND
    upper = ABSENT_GAP + REVIEW_BAND

    if gap < lower:
        return "PRESENT"
    elif gap <= upper:
        # Borderline — flag for instructor review
        return "NEEDS_REVIEW"
    else:
        return "LEFT_EARLY" if had_check_in else "ABSENT"


def _is_duplicate_entry(db: Session, usn: str, event_time: datetime) -> bool:
    """Check if there's a recent ENTRY event within the cooldown window."""
    cutoff = event_time - COOLDOWN
    recent = (
        db.query(AttendanceEvent)
        .filter(
            AttendanceEvent.usn == usn,
            AttendanceEvent.event_type == "ENTRY",
            AttendanceEvent.event_time >= cutoff,
        )
        .first()
    )
    return recent is not None


def _get_or_create_attendance(db: Session, usn: str, session_id: int) -> Attendance:
    """Get existing attendance record or create a new PENDING one."""
    record = (
        db.query(Attendance)
        .filter(Attendance.usn == usn, Attendance.session_id == session_id)
        .first()
    )
    if record is None:
        record = Attendance(
            usn=usn,
            session_id=session_id,
            status="PENDING",
            status_source="AUTO",
        )
        db.add(record)
        db.flush()  # get the ID without committing
    return record


def _append_event(
    db: Session,
    usn: str,
    event_type: str,
    camera_id: str,
    confidence: Optional[float],
    event_time: datetime,
    session_id: int,
):
    """Append a raw recognition event to the event log."""
    evt = AttendanceEvent(
        usn=usn,
        session_id=session_id,
        event_type=event_type,
        camera_id=camera_id,
        confidence=confidence,
        event_time=event_time,
    )
    db.add(evt)
    db.flush()


def _audit(db: Session, actor: str, action: str, entity: str, entity_id: str, details: dict):
    """Append to audit log."""
    log = AuditLog(
        actor=actor,
        action=action,
        target_entity=entity,
        target_id=entity_id,
        timestamp=datetime.utcnow(),
        details=json.dumps(details),
    )
    db.add(log)
    db.commit()
