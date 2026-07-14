"""
Inframe MVP — Events Route

POST /api/v1/events — the core endpoint the edge camera process hits.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EventIn, EventOut
from ..services.attendance import handle_event
from ..websockets import manager

router = APIRouter(prefix="/api/v1", tags=["events"])


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(event: EventIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Receive a recognition event from the edge camera process.
    """
    event_time = event.event_time or datetime.utcnow()

    record = handle_event(
        db=db,
        usn=event.usn,
        event_type=event.event_type.value,
        event_time=event_time,
        camera_id=event.camera_id,
        confidence=event.confidence,
    )

    resolved_status = record.status if record else None
    
    if record:
        # Broadcast the update
        background_tasks.add_task(
            manager.broadcast,
            {
                "type": "attendance_update",
                "data": {
                    "usn": event.usn,
                    "status": resolved_status,
                    "session_id": record.session_id,
                    "last_seen_time": str(record.last_seen_time) if record.last_seen_time else None,
                    "check_in_time": str(record.check_in_time) if record.check_in_time else None,
                }
            }
        )

    return EventOut(
        id=0,
        session_id=record.session_id if record else 0,
        usn=event.usn,
        event_type=event.event_type,
        camera_id=event.camera_id,
        confidence=event.confidence,
        event_time=event_time,
        resolved_status=resolved_status,
    )


@router.post("/events/frame/{camera_id}", status_code=201)
async def upload_frame(camera_id: str, background_tasks: BackgroundTasks, frame_data: dict = Body(...)):
    """
    Receive a JSON dictionary containing the frame and bounding boxes from the edge camera process.
    """
    import json
    background_tasks.add_task(manager.broadcast_live_feed, camera_id, json.dumps(frame_data))
    return {"status": "ok"}


# Global state for camera control and subprocess management
import subprocess
import sys
import atexit
from pathlib import Path

CAMERA_ACTIVE = False
camera_process = None

def _start_camera_process():
    global camera_process
    if camera_process is not None:
        if camera_process.poll() is None:
            return  # Already running
        else:
            camera_process = None

    attendence_dir = Path(__file__).resolve().parents[2]
    try:
        camera_process = subprocess.Popen(
            [sys.executable, "-m", "backend.edge.camera"],
            cwd=str(attendence_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass

def _stop_camera_process():
    global camera_process
    if camera_process is not None:
        if camera_process.poll() is None:
            camera_process.terminate()
            try:
                camera_process.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                camera_process.kill()
        camera_process = None

atexit.register(_stop_camera_process)


@router.get("/camera/state")
async def get_camera_state():
    """Return whether the camera should be streaming."""
    global CAMERA_ACTIVE
    if CAMERA_ACTIVE:
        _start_camera_process()
    return {"active": CAMERA_ACTIVE}

@router.post("/camera/start")
async def start_camera():
    """Start the camera stream."""
    global CAMERA_ACTIVE
    CAMERA_ACTIVE = True
    _start_camera_process()
    return {"active": CAMERA_ACTIVE}

@router.post("/camera/stop")
async def stop_camera():
    """Stop the camera stream."""
    global CAMERA_ACTIVE
    CAMERA_ACTIVE = False
    _stop_camera_process()
    return {"active": CAMERA_ACTIVE}


