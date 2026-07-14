"""
Inframe — Analytics Route

Provides aggregated attendance data for the Analytics dashboard:
daily counts, weekly heatmap, and student leaderboard.
"""

from datetime import date, timedelta, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract

from ..database import get_db, Attendance, ClassSession, Person

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/daily")
def daily_attendance(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Daily attendance counts for the last N days.
    Returns: [{ date, present, absent, late, total }]
    """
    cutoff = date.today() - timedelta(days=days)

    rows = (
        db.query(
            ClassSession.date,
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status == "PRESENT", 1), else_=0)).label("present"),
            func.sum(case((Attendance.status == "ABSENT", 1), else_=0)).label("absent"),
            func.sum(case((Attendance.status == "LATE", 1), else_=0)).label("late"),
            func.sum(case((Attendance.status == "LEFT_EARLY", 1), else_=0)).label("left_early"),
        )
        .join(ClassSession, Attendance.session_id == ClassSession.id)
        .filter(ClassSession.date >= cutoff)
        .group_by(ClassSession.date)
        .order_by(ClassSession.date)
        .all()
    )

    return [
        {
            "date": str(row.date),
            "total": row.total,
            "present": row.present,
            "absent": row.absent,
            "late": row.late,
            "left_early": row.left_early,
        }
        for row in rows
    ]


@router.get("/summary")
def attendance_summary(db: Session = Depends(get_db)):
    """
    Overall attendance stats for dashboard cards.
    Returns: { total_students, present_today, avg_attendance_pct, total_sessions }
    """
    total_students = db.query(func.count(Person.usn)).filter(Person.active == True).scalar() or 0

    today = date.today()
    today_sessions = (
        db.query(ClassSession.id)
        .filter(ClassSession.date == today)
        .subquery()
    )

    present_today = (
        db.query(func.count(Attendance.id))
        .filter(
            Attendance.session_id.in_(today_sessions),
            Attendance.status.in_(["PRESENT", "LATE"]),
        )
        .scalar()
    ) or 0

    total_sessions = db.query(func.count(ClassSession.id)).scalar() or 0

    # Average attendance percentage (last 30 days)
    cutoff = today - timedelta(days=30)
    recent_total = (
        db.query(func.count(Attendance.id))
        .join(ClassSession, Attendance.session_id == ClassSession.id)
        .filter(ClassSession.date >= cutoff)
        .scalar()
    ) or 0

    recent_present = (
        db.query(func.count(Attendance.id))
        .join(ClassSession, Attendance.session_id == ClassSession.id)
        .filter(
            ClassSession.date >= cutoff,
            Attendance.status.in_(["PRESENT", "LATE"]),
        )
        .scalar()
    ) or 0

    avg_pct = round((recent_present / recent_total * 100), 1) if recent_total > 0 else 0

    return {
        "total_students": total_students,
        "present_today": present_today,
        "avg_attendance_pct": avg_pct,
        "total_sessions": total_sessions,
    }


@router.get("/top-students")
def top_students(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Students ranked by attendance percentage (most to least punctual).
    Returns: [{ usn, name, total_sessions, present_count, pct }]
    """
    rows = (
        db.query(
            Attendance.usn,
            Person.name,
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).label("present"),
        )
        .outerjoin(Person, Attendance.usn == Person.usn)
        .group_by(Attendance.usn, Person.name)
        .order_by(func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "usn": row.usn,
            "name": row.name or row.usn,
            "total_sessions": row.total,
            "present_count": row.present,
            "pct": round((row.present / row.total * 100), 1) if row.total > 0 else 0,
        }
        for row in rows
    ]
