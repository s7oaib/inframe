"""
Inframe MVP — Pydantic Schemas (request / response models)
"""

from datetime import datetime, date
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field


# ── Enums ──

class EventType(str, Enum):
    ENTRY = "ENTRY"
    SEEN = "SEEN"
    EXIT = "EXIT"
    UNMATCHED = "UNMATCHED"


class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LEFT_EARLY = "LEFT_EARLY"
    PENDING = "PENDING"
    LATE = "LATE"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class StatusSource(str, Enum):
    AUTO = "AUTO"
    OVERRIDE = "OVERRIDE"


# ── Events ──

class EventIn(BaseModel):
    usn: str = Field(..., max_length=15, examples=["1HK23AI048"])
    event_type: EventType
    camera_id: str = Field(default="CAM-01", max_length=50)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    event_time: Optional[datetime] = None  # defaults to now() server-side

    class Config:
        json_schema_extra = {
            "example": {
                "usn": "1HK23AI048",
                "event_type": "ENTRY",
                "camera_id": "CAM-01",
                "confidence": 0.92,
            }
        }


class EventOut(BaseModel):
    id: int
    session_id: int
    usn: str
    event_type: EventType
    camera_id: str
    confidence: Optional[float]
    event_time: datetime
    resolved_status: Optional[AttendanceStatus] = None


# ── Person ──

class PersonIn(BaseModel):
    usn: str = Field(..., max_length=15, examples=["1HK23AI048"])
    name: Optional[str] = Field(None, max_length=100)
    consent_given: bool = False


class PersonOut(BaseModel):
    usn: str
    name: Optional[str]
    enrolled_at: datetime
    active: bool
    consent_given: bool

    class Config:
        from_attributes = True


# ── Auth & Users ──

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Sessions ──

class ClassSessionIn(BaseModel):
    name: str = Field(..., max_length=100)
    camera_id: str = Field(..., max_length=50)

class ClassSessionOut(BaseModel):
    id: int
    name: str
    camera_id: str
    date: date
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Attendance ──

class AttendanceOut(BaseModel):
    id: int
    session_id: int
    usn: str
    check_in_time: Optional[datetime]
    last_seen_time: Optional[datetime]
    check_out_time: Optional[datetime]
    status: AttendanceStatus
    status_source: StatusSource
    override_reason: Optional[str]
    updated_at: datetime
    # Joined from person table
    name: Optional[str] = None

    class Config:
        from_attributes = True


class OverrideIn(BaseModel):
    session_id: int
    status: AttendanceStatus
    reason: str = Field(..., min_length=3, max_length=200, examples=["Student was present — camera misidentified"])


class OverrideOut(BaseModel):
    usn: str
    session_id: int
    old_status: AttendanceStatus
    new_status: AttendanceStatus
    reason: str
    overridden_by: str


# ── Export ──

class ExportQuery(BaseModel):
    session_id: int
    format: str = Field(default="csv", pattern="^(csv|json)$")


# ── Audit Log ──

class AuditLogOut(BaseModel):
    id: int
    actor: str
    action: str
    target_entity: Optional[str]
    target_id: Optional[str]
    timestamp: datetime
    details: Optional[str]

    class Config:
        from_attributes = True


# ── Session close ──

class SessionCloseOut(BaseModel):
    session_id: int
    records_resolved: int
    statuses: dict[str, int]  # e.g. {"PRESENT": 12, "ABSENT": 3}
