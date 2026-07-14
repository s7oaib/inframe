"""
Inframe MVP — Attendance Route

Queries, overrides, and CSV export for attendance records.
"""

import csv
import io
import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db, Attendance, Person, AuditLog, User
from ..models import AttendanceOut, OverrideIn, OverrideOut, AuditLogOut
from ..services.attendance import override_status
from .auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["attendance"])


@router.get("/attendance", response_model=list[AttendanceOut])
def list_attendance(
    session_id: int = Query(..., description="Session ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Full roster + status for a given session.
    Joins with Person table to include student names.
    """
    records = (
        db.query(Attendance, Person.name)
        .outerjoin(Person, Attendance.usn == Person.usn)
        .filter(Attendance.session_id == session_id)
        .order_by(Attendance.usn)
        .all()
    )

    result = []
    for record, name in records:
        out = AttendanceOut.model_validate(record)
        out.name = name
        result.append(out)
    return result


@router.get("/attendance/{usn}", response_model=AttendanceOut)
def get_attendance(
    usn: str,
    session_id: int = Query(..., description="Session ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single student's attendance for a specific session."""
    row = (
        db.query(Attendance, Person.name)
        .outerjoin(Person, Attendance.usn == Person.usn)
        .filter(Attendance.usn == usn, Attendance.session_id == session_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"No attendance record for {usn} in session {session_id}")

    record, name = row
    out = AttendanceOut.model_validate(record)
    out.name = name
    return out


@router.post("/attendance/{usn}/override", response_model=OverrideOut)
def override_attendance(
    usn: str,
    override: OverrideIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Instructor manually corrects a student's attendance status.
    Requires a reason code — not a free-text box that gets ignored (PRD §10.1).
    """
    # Get old status for the response
    existing = (
        db.query(Attendance)
        .filter(Attendance.usn == usn, Attendance.session_id == override.session_id)
        .first()
    )
    if not existing:
        raise HTTPException(
            status_code=404,
            detail=f"No attendance record for {usn} in session {override.session_id}",
        )

    old_status = existing.status

    record = override_status(
        db=db,
        usn=usn,
        session_id=override.session_id,
        new_status=override.status.value,
        reason=override.reason,
        actor="instructor",
    )

    if not record:
        raise HTTPException(status_code=500, detail="Override failed unexpectedly")

    return OverrideOut(
        usn=usn,
        session_id=override.session_id,
        old_status=old_status,
        new_status=override.status,
        reason=override.reason,
        overridden_by="instructor",
    )


@router.get("/attendance/export/csv")
def export_attendance_csv(
    session_id: int = Query(..., description="Session ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export attendance as CSV for a given session."""
    records = (
        db.query(Attendance, Person.name)
        .outerjoin(Person, Attendance.usn == Person.usn)
        .filter(Attendance.session_id == session_id)
        .order_by(Attendance.usn)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "USN", "Name", "Check In", "Last Seen",
        "Check Out", "Status", "Source", "Override Reason",
    ])

    for record, name in records:
        writer.writerow([
            record.usn,
            name or "",
            str(record.check_in_time or ""),
            str(record.last_seen_time or ""),
            str(record.check_out_time or ""),
            record.status,
            record.status_source,
            record.override_reason or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_session_{session_id}.csv"},
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    target_entity: Optional[str] = None,
    target_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve audit trail. Filterable by entity type and ID."""
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())

    if target_entity:
        query = query.filter(AuditLog.target_entity == target_entity)
    if target_id:
        query = query.filter(AuditLog.target_id == target_id)

    return query.offset(offset).limit(limit).all()
