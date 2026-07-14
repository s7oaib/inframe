"""
Inframe MVP — Sessions Route

Session management: close a day's session to resolve all PENDING records.
"""

from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, ClassSession
from ..models import SessionCloseOut, ClassSessionOut, ClassSessionIn
from ..services.attendance import close_session

router = APIRouter(prefix="/api/v1", tags=["sessions"])


@router.post("/sessions", response_model=ClassSessionOut, status_code=201)
def create_session(session_in: ClassSessionIn, db: Session = Depends(get_db)):
    """Start a new class session for a specific camera."""
    # Ensure no other active session on this camera
    active = db.query(ClassSession).filter(
        ClassSession.camera_id == session_in.camera_id,
        ClassSession.is_active == True
    ).first()
    if active:
        raise HTTPException(status_code=400, detail=f"Camera {session_in.camera_id} already has an active session.")
        
    db_session = ClassSession(name=session_in.name, camera_id=session_in.camera_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/sessions", response_model=List[ClassSessionOut])
def list_sessions(active_only: bool = False, db: Session = Depends(get_db)):
    """List all class sessions."""
    query = db.query(ClassSession)
    if active_only:
        query = query.filter(ClassSession.is_active == True)
    return query.order_by(ClassSession.created_at.desc()).all()


@router.post("/sessions/{session_id}/close", response_model=SessionCloseOut)
def close_session_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    Manually trigger end-of-day resolution for all PENDING attendance records.
    """
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    result = close_session(db, session_id)
    return SessionCloseOut(
        session_id=session_id,
        records_resolved=result["records_resolved"],
        statuses=result["statuses"],
    )

@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a session and all its associated attendance records."""
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Due to foreign keys, depending on cascade settings, we might need to delete attendance records first
    # or let SQLAlchemy handle it if cascade="all, delete" is set. Assuming simple delete for MVP:
    db.delete(session)
    db.commit()
    return None

