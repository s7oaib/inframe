"""
Inframe MVP — Configuration
All thresholds are overridable via environment variables so the presence
rule can be adjusted without a code change (PRD §2, Tech Spec §0).
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # ── Database ──
    DATABASE_URL: str = "sqlite:///./inframe.db"

    # ── Presence rule (Tech Spec §0 / PRD §8.2) ──
    # "Staleness check": if now - last_seen_at > this threshold → ABSENT
    ABSENT_GAP_MINUTES: float = 0.5  # 0.5 minutes = 30 seconds for testing
    # Grace period after session start before a student is marked LATE
    LATE_GRACE_MINUTES: int = 10
    # Band around threshold that triggers NEEDS_REVIEW instead of auto-resolve
    REVIEW_BAND_MINUTES: int = 5

    # ── Recognition ──
    # Minimum face_recognition distance to accept a match (lower = stricter)
    CONFIDENCE_THRESHOLD: float = 0.6
    # Seconds to ignore duplicate ENTRY events for the same USN
    DUPLICATE_EVENT_COOLDOWN_SECONDS: int = 5

    # ── Edge / Camera ──
    CAMERA_ID: str = "CAM-01"
    CAMERA_DEVICE_INDEX: int = 0
    # How often to grab a frame (seconds)
    CAPTURE_INTERVAL_SECONDS: float = 0.5
    # Backend URL the edge process POSTs events to
    BACKEND_URL: str = "http://localhost:8000"

    # ── Embeddings storage ──
    EMBEDDINGS_DIR: str = str(Path(__file__).parent / "embeddings")

    # ── CORS (for dashboard on a different port) ──
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]

    model_config = {"env_prefix": "INFRAME_", "env_file": ".env"}


settings = Settings()
