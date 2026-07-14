"""
Inframe MVP — Persons Route

CRUD for the person (student) table. Enrollment, lookup, deactivation.
Also includes quick-enroll from the live feed dashboard.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db, Person, AuditLog, User
from ..models import PersonIn, PersonOut
from ..services import recognition, enrollment
from .auth import get_current_user

import json
import base64
from datetime import datetime

router = APIRouter(prefix="/api/v1", tags=["persons"])


# ── Quick-enroll model (from live feed) ──
class QuickEnrollRequest(BaseModel):
    usn: str
    name: str
    section: str = ""
    face_image: str  # base64 JPEG
    consent_given: bool = False


@router.post("/persons", response_model=PersonOut, status_code=201)
def create_person(
    person: PersonIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enroll a new USN into the roster."""
    existing = db.query(Person).filter(Person.usn == person.usn).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"USN {person.usn} already exists")

    db_person = Person(usn=person.usn, name=person.name, consent_given=person.consent_given)
    db.add(db_person)

    # Audit
    db.add(AuditLog(
        actor="api",
        action="PERSON_CREATED",
        target_entity="person",
        target_id=person.usn,
        timestamp=datetime.utcnow(),
        details=json.dumps({"name": person.name}),
    ))
    db.commit()
    db.refresh(db_person)
    return db_person


@router.get("/persons", response_model=list[PersonOut])
def list_persons(active_only: bool = True, db: Session = Depends(get_db)):
    """List all enrolled students."""
    query = db.query(Person)
    if active_only:
        query = query.filter(Person.active == True)
    return query.order_by(Person.usn).all()


@router.get("/persons/{usn}", response_model=PersonOut)
def get_person(usn: str, db: Session = Depends(get_db)):
    """Lookup a single student by USN."""
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"USN {usn} not found")
    return person


@router.delete("/persons/{usn}")
def deactivate_person(
    usn: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a student (deactivate). Also removes their embedding."""
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"USN {usn} not found")

    person.active = False
    recognition.remove_embedding(usn)

    db.add(AuditLog(
        actor="api",
        action="PERSON_DEACTIVATED",
        target_entity="person",
        target_id=usn,
        timestamp=datetime.utcnow(),
        details=json.dumps({"reason": "manual deactivation"}),
    ))
    db.commit()
    return {"detail": f"USN {usn} deactivated and embedding removed"}


@router.post("/persons/{usn}/consent")
def update_consent(
    usn: str,
    consent_given: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update student biometric consent. If consent is revoked, their embedding is deleted."""
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"USN {usn} not found")

    person.consent_given = consent_given

    if not consent_given:
        # Revoke consent -> remove biometric data immediately
        recognition.remove_embedding(usn)

    db.add(AuditLog(
        actor="api",
        action="CONSENT_UPDATED",
        target_entity="person",
        target_id=usn,
        timestamp=datetime.utcnow(),
        details=json.dumps({"consent_given": consent_given}),
    ))
    db.commit()
    return {"detail": f"Consent updated to {consent_given} for {usn}"}


@router.post("/persons/{usn}/reactivate")
def reactivate_person(
    usn: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reactivate a student. They will need new photos enrolled for face recognition."""
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"USN {usn} not found")

    person.active = True

    db.add(AuditLog(
        actor="api",
        action="PERSON_REACTIVATED",
        target_entity="person",
        target_id=usn,
        timestamp=datetime.utcnow(),
        details=json.dumps({"reason": "manual reactivation"}),
    ))
    db.commit()
    return {"detail": f"USN {usn} reactivated"}


@router.post("/persons/{usn}/enroll-photos")
async def enroll_photos(
    usn: str,
    photos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload 3-5 photos for a student and generate their face embedding.
    The student must already exist in the roster (POST /persons first).
    """
    person = db.query(Person).filter(Person.usn == usn).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"USN {usn} not found — create the person first")

    if not person.consent_given:
        raise HTTPException(status_code=400, detail="Biometric consent must be granted to enroll photos")

    if len(photos) < 1:
        raise HTTPException(status_code=400, detail="At least 1 photo is required (3-5 recommended)")

    # Read all uploaded files
    file_bytes_list = []
    for photo in photos:
        content = await photo.read()
        file_bytes_list.append(content)

    result = enrollment.enroll_from_upload(usn, file_bytes_list)

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["message"])

    db.add(AuditLog(
        actor="api",
        action="PHOTOS_ENROLLED",
        target_entity="person",
        target_id=usn,
        timestamp=datetime.utcnow(),
        details=json.dumps(result),
    ))
    db.commit()

    return result


# ══════════════════════════════════════════════════════
# Quick-Enroll from Live Feed (single face capture)
# ══════════════════════════════════════════════════════

@router.post("/students/enroll")
def quick_enroll(
    req: QuickEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    One-shot enrollment from the live feed dashboard.
    Creates the person + generates face encoding from a single captured frame.
    """
    usn = req.usn.strip().upper()
    name = req.name.strip()

    if not usn or not name:
        raise HTTPException(status_code=400, detail="USN and name are required")

    # Check if person already exists
    existing = db.query(Person).filter(Person.usn == usn).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"USN {usn} already exists")

    # Decode base64 face image
    try:
        image_bytes = base64.b64decode(req.face_image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 face image")

    if not req.consent_given:
        raise HTTPException(status_code=400, detail="Biometric consent is required to quick-enroll")

    # Create person record
    db_person = Person(usn=usn, name=name, consent_given=req.consent_given)
    db.add(db_person)

    # Generate face encoding from the captured image
    enroll_result = enrollment.enroll_from_upload(usn, [image_bytes])

    if not enroll_result["success"]:
        db.rollback()
        raise HTTPException(status_code=422, detail=enroll_result["message"])

    # Audit log
    db.add(AuditLog(
        actor="dashboard",
        action="QUICK_ENROLLED",
        target_entity="person",
        target_id=usn,
        timestamp=datetime.utcnow(),
        details=json.dumps({
            "name": name,
            "section": req.section,
            "source": "live_feed",
            "encoding_result": enroll_result["message"],
        }),
    ))
    db.commit()
    db.refresh(db_person)

    return {
        "usn": usn,
        "name": name,
        "section": req.section,
        "success": True,
        "message": f"Student {usn} enrolled successfully from live feed",
    }
