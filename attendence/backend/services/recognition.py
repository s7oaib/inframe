"""
Inframe MVP — Face Recognition Service

Handles embedding extraction, storage, and matching using the
face_recognition library (dlib-based). Embeddings are stored as .npy
files on disk, keyed by USN.
"""

import os
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)

# In-memory cache of enrolled embeddings: {usn: np.ndarray}
_enrolled: dict[str, np.ndarray] = {}


def init_embeddings_dir():
    """Ensure the embeddings directory exists."""
    Path(settings.EMBEDDINGS_DIR).mkdir(parents=True, exist_ok=True)


def load_all_embeddings():
    """Load all enrolled embeddings from disk into memory."""
    global _enrolled
    _enrolled.clear()
    emb_dir = Path(settings.EMBEDDINGS_DIR)
    if not emb_dir.exists():
        logger.warning("Embeddings directory does not exist: %s", emb_dir)
        return

    for npy_file in emb_dir.glob("*.npy"):
        usn = npy_file.stem
        try:
            _enrolled[usn] = np.load(str(npy_file))
            logger.info("Loaded embedding for USN: %s", usn)
        except Exception as e:
            logger.error("Failed to load embedding for %s: %s", usn, e)

    logger.info("Loaded %d enrolled embeddings", len(_enrolled))


def enroll(usn: str, photos: list[np.ndarray]) -> dict:
    """
    Enroll a student by extracting face embeddings from multiple photos.

    Args:
        usn: University Seat Number
        photos: List of BGR images (numpy arrays from OpenCV or similar)

    Returns:
        dict with 'success', 'total_photos', 'faces_detected', 'message'
    """
    try:
        import face_recognition
    except ImportError:
        return _enroll_fallback(usn, photos)

    embeddings = []
    for i, photo in enumerate(photos):
        # face_recognition expects RGB
        rgb = photo[:, :, ::-1] if photo.shape[2] == 3 else photo
        encodings = face_recognition.face_encodings(rgb)
        if len(encodings) == 0:
            logger.warning("No face detected in photo %d for USN %s", i + 1, usn)
            continue
        if len(encodings) > 1:
            logger.warning("Multiple faces in photo %d for USN %s — using first", i + 1, usn)
        embeddings.append(encodings[0])

    if len(embeddings) == 0:
        return {
            "success": False,
            "total_photos": len(photos),
            "faces_detected": 0,
            "message": "No faces detected in any of the provided photos.",
        }

    # Average the embeddings for a more robust template
    avg_embedding = np.mean(embeddings, axis=0)
    _save_embedding(usn, avg_embedding)

    return {
        "success": True,
        "total_photos": len(photos),
        "faces_detected": len(embeddings),
        "message": f"Enrolled {usn} with {len(embeddings)}/{len(photos)} photos.",
    }


def match(embedding: np.ndarray) -> tuple[Optional[str], float]:
    """
    Match a face embedding against all enrolled students.

    Returns:
        (usn, distance) if match found below threshold, else (None, best_distance)
    """
    if not _enrolled:
        return None, 1.0

    best_usn = None
    best_distance = 1.0

    for usn, enrolled_emb in _enrolled.items():
        distance = np.linalg.norm(embedding - enrolled_emb)
        if distance < best_distance:
            best_distance = distance
            best_usn = usn

    if best_distance <= settings.CONFIDENCE_THRESHOLD:
        return best_usn, best_distance
    else:
        return None, best_distance


def match_from_photo(photo: np.ndarray) -> tuple[Optional[str], float]:
    """
    Detect face in a photo, extract embedding, and match against enrolled.

    Returns:
        (usn, confidence) where confidence = 1 - distance, or (None, 0.0)
    """
    try:
        import face_recognition
    except ImportError:
        return None, 0.0

    rgb = photo[:, :, ::-1] if photo.shape[2] == 3 else photo
    encodings = face_recognition.face_encodings(rgb)
    if not encodings:
        return None, 0.0

    usn, distance = match(encodings[0])
    confidence = max(0.0, 1.0 - distance)
    return usn, confidence


def remove_embedding(usn: str) -> bool:
    """Remove an enrolled embedding (consent withdrawal / deactivation)."""
    emb_path = Path(settings.EMBEDDINGS_DIR) / f"{usn}.npy"
    if emb_path.exists():
        emb_path.unlink()
    _enrolled.pop(usn, None)
    return True


def is_enrolled(usn: str) -> bool:
    """Check if a USN has an enrolled embedding."""
    return usn in _enrolled


def get_enrolled_count() -> int:
    """Number of currently enrolled embeddings in memory."""
    return len(_enrolled)


# ── Private helpers ──

def _save_embedding(usn: str, embedding: np.ndarray):
    """Save embedding to disk and update in-memory cache."""
    init_embeddings_dir()
    path = Path(settings.EMBEDDINGS_DIR) / f"{usn}.npy"
    np.save(str(path), embedding)
    _enrolled[usn] = embedding
    logger.info("Saved embedding for USN: %s → %s", usn, path)


def _enroll_fallback(usn: str, photos: list) -> dict:
    """
    Fallback enrollment when face_recognition is not installed.
    Generates a random embedding for testing/development purposes.
    """
    logger.warning(
        "face_recognition not installed — generating random embedding for USN %s. "
        "This is for development/testing only!",
        usn,
    )
    fake_embedding = np.random.randn(128).astype(np.float64)
    _save_embedding(usn, fake_embedding)
    return {
        "success": True,
        "total_photos": len(photos),
        "faces_detected": len(photos),
        "message": f"[DEV MODE] Enrolled {usn} with fake embedding — install face_recognition for real enrollment.",
    }
