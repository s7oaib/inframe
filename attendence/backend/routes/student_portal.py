"""
Inframe — Student Portal Route

Provides student self-service endpoints:
- Login with USN + password
- View own attendance history
- View own attendance percentage
"""

import json
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Boolean, func, case

from ..database import get_db, Person, Attendance, ClassSession, Base, engine
from ..services.auth import verify_password, get_password_hash

# ── Student password model ──
class StudentAuth(Base):
    __tablename__ = "student_auth"

    usn = Column(String(15), primary_key=True)
    hashed_password = Column(String(200), nullable=False)
    active = Column(Boolean, default=True)

# Create table
Base.metadata.create_all(bind=engine)


# ── Request/Response Models ──
class StudentLoginRequest(BaseModel):
    usn: str
    password: str

class StudentRegisterRequest(BaseModel):
    usn: str
    password: str

class StudentProfileOut(BaseModel):
    usn: str
    name: str
    total_sessions: int
    present_count: int
    attendance_pct: float
    status: str  # "Good Standing" / "At Risk" / "Critical"

class StudentAttendanceRecord(BaseModel):
    date: str
    session_name: str
    status: str
    check_in_time: Optional[str]


router = APIRouter(prefix="/api/v1/student", tags=["student-portal"])


@router.post("/register")
def register_student(req: StudentRegisterRequest, db: Session = Depends(get_db)):
    """Register a student with USN + password. Student must already be enrolled."""
    usn = req.usn.strip().upper()

    # Check student exists
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail="USN not found. Please ask your instructor to enroll you first.")

    # Check if already registered
    existing = db.query(StudentAuth).filter(StudentAuth.usn == usn).first()
    if existing:
        raise HTTPException(status_code=409, detail="Student already registered. Use login instead.")

    auth = StudentAuth(usn=usn, hashed_password=get_password_hash(req.password))
    db.add(auth)
    db.commit()

    return {"usn": usn, "message": "Registration successful. You can now login."}


@router.post("/login")
def login_student(req: StudentLoginRequest, db: Session = Depends(get_db)):
    """Login with USN + password."""
    usn = req.usn.strip().upper()

    auth = db.query(StudentAuth).filter(StudentAuth.usn == usn).first()
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid USN or password")

    if not verify_password(req.password, auth.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid USN or password")

    person = db.query(Person).filter(Person.usn == usn).first()
    name = person.name if person else usn

    return {"usn": usn, "name": name, "authenticated": True}


@router.get("/profile/{usn}", response_model=StudentProfileOut)
def get_student_profile(usn: str, db: Session = Depends(get_db)):
    """Get student attendance profile."""
    usn = usn.upper()

    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail="Student not found")

    total = db.query(func.count(Attendance.id)).filter(Attendance.usn == usn).scalar() or 0
    present = (
        db.query(func.count(Attendance.id))
        .filter(Attendance.usn == usn, Attendance.status.in_(["PRESENT", "LATE"]))
        .scalar()
    ) or 0

    pct = round((present / total * 100), 1) if total > 0 else 0

    if pct >= 75:
        status = "Good Standing"
    elif pct >= 60:
        status = "At Risk"
    else:
        status = "Critical"

    return StudentProfileOut(
        usn=usn,
        name=person.name or usn,
        total_sessions=total,
        present_count=present,
        attendance_pct=pct,
        status=status,
    )


@router.get("/attendance/{usn}", response_model=list[StudentAttendanceRecord])
def get_student_attendance(
    usn: str,
    days: int = 30,
    db: Session = Depends(get_db),
):
    """Get student's attendance history."""
    usn = usn.upper()
    cutoff = date.today() - timedelta(days=days)

    records = (
        db.query(Attendance, ClassSession.date, ClassSession.name)
        .join(ClassSession, Attendance.session_id == ClassSession.id)
        .filter(Attendance.usn == usn, ClassSession.date >= cutoff)
        .order_by(ClassSession.date.desc())
        .all()
    )

    return [
        StudentAttendanceRecord(
            date=str(sess_date),
            session_name=sess_name or "",
            status=record.status,
            check_in_time=record.check_in_time.strftime("%H:%M") if record.check_in_time else None,
        )
        for record, sess_date, sess_name in records
    ]
