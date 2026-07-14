"""
Inframe — Schedule Route

CRUD for class schedules (time slots per day).
"""

from datetime import time
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Time, Boolean
from datetime import datetime

from ..database import get_db, Base, engine

# ── Schedule Model ──
class ScheduleSlot(Base):
    __tablename__ = "schedule_slot"

    id = Column(Integer, primary_key=True, autoincrement=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon, 1=Tue, ..., 6=Sun
    subject = Column(String(100), nullable=False)
    teacher = Column(String(100), nullable=True)
    start_time = Column(String(5), nullable=False)  # "09:00"
    end_time = Column(String(5), nullable=False)    # "10:00"
    classroom = Column(String(50), nullable=True)
    active = Column(Boolean, default=True)

# Create table
Base.metadata.create_all(bind=engine)


# ── Pydantic Models ──
class SlotCreate(BaseModel):
    day_of_week: int  # 0-6
    subject: str
    teacher: str = ""
    start_time: str  # "HH:MM"
    end_time: str
    classroom: str = ""

class SlotOut(BaseModel):
    id: int
    day_of_week: int
    subject: str
    teacher: str
    start_time: str
    end_time: str
    classroom: str
    active: bool

    class Config:
        from_attributes = True

class SlotUpdate(BaseModel):
    subject: Optional[str] = None
    teacher: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    classroom: Optional[str] = None
    day_of_week: Optional[int] = None


router = APIRouter(prefix="/api/v1/schedule", tags=["schedule"])


@router.get("", response_model=List[SlotOut])
def list_schedule(db: Session = Depends(get_db)):
    """List all schedule slots, ordered by day and time."""
    return (
        db.query(ScheduleSlot)
        .filter(ScheduleSlot.active == True)
        .order_by(ScheduleSlot.day_of_week, ScheduleSlot.start_time)
        .all()
    )


@router.post("", response_model=SlotOut, status_code=201)
def create_slot(slot: SlotCreate, db: Session = Depends(get_db)):
    """Create a new schedule slot."""
    db_slot = ScheduleSlot(
        day_of_week=slot.day_of_week,
        subject=slot.subject,
        teacher=slot.teacher,
        start_time=slot.start_time,
        end_time=slot.end_time,
        classroom=slot.classroom,
    )
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    return db_slot


@router.put("/{slot_id}", response_model=SlotOut)
def update_slot(slot_id: int, update: SlotUpdate, db: Session = Depends(get_db)):
    """Update an existing schedule slot."""
    slot = db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)

    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}")
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    """Soft-delete a schedule slot."""
    slot = db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    slot.active = False
    db.commit()
    return {"detail": f"Slot {slot_id} deleted"}


@router.get("/current")
def current_class(db: Session = Depends(get_db)):
    """Get the currently active class based on day and time."""
    now = datetime.now()
    day = now.weekday()  # 0=Mon
    current_time = now.strftime("%H:%M")

    slot = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.day_of_week == day,
            ScheduleSlot.start_time <= current_time,
            ScheduleSlot.end_time > current_time,
            ScheduleSlot.active == True,
        )
        .first()
    )

    if slot:
        return SlotOut.model_validate(slot)
    return {"message": "No class currently in session", "current_time": current_time, "day": day}
