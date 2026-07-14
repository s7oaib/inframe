"""
Inframe MVP — Edge Face Detector (MediaPipe + face_recognition hybrid)

Uses Google MediaPipe for blazing-fast face detection (10-50x faster than dlib HOG),
then uses face_recognition only for encoding/matching against enrolled students.
Falls back to Haar cascades if neither library is available.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import cv2

from ..services import recognition
from ..config import settings
from . import liveness as liveness_checker

logger = logging.getLogger(__name__)

# Track which USNs are currently "in frame" and when they were last seen.
_active_tracks: dict[str, datetime] = {}
_GONE_THRESHOLD = timedelta(seconds=settings.CAPTURE_INTERVAL_SECONDS * 10)

# ── MediaPipe face detector (initialized once, reused forever) ──────────
_mp_face_detection = None
_mp_initialized = False

def _get_mediapipe_detector():
    """Lazy-init MediaPipe face detection. Returns None if not available."""
    global _mp_face_detection, _mp_initialized
    if _mp_initialized:
        return _mp_face_detection
    _mp_initialized = True
    try:
        import mediapipe as mp
        _mp_face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=0,        # 0 = short-range (< 2m), 1 = full-range (< 5m)
            min_detection_confidence=0.5
        )
        logger.info("MediaPipe face detection initialized (GPU-accelerated where available)")
    except (ImportError, AttributeError):
        logger.warning("mediapipe not installed or incomplete, will fall back to dlib/Haar")
        _mp_face_detection = None
    return _mp_face_detection


def _detect_faces_mediapipe(frame: np.ndarray):
    """
    Detect faces using MediaPipe. Returns list of (top, right, bottom, left) tuples
    in the same format face_recognition uses, so the rest of the pipeline is unchanged.
    """
    detector = _get_mediapipe_detector()
    if detector is None:
        return []

    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detector.process(rgb)

    locations = []
    if results.detections:
        for det in results.detections:
            bbox = det.location_data.relative_bounding_box
            x_min = max(0, int(bbox.xmin * w))
            y_min = max(0, int(bbox.ymin * h))
            box_w = int(bbox.width * w)
            box_h = int(bbox.height * h)

            top = y_min
            right = min(w, x_min + box_w)
            bottom = min(h, y_min + box_h)
            left = x_min
            locations.append((top, right, bottom, left))

    return locations


def process_frame(frame: np.ndarray, camera_id: str):
    """
    Process a single video frame:
    1. Detect faces (MediaPipe → dlib HOG → Haar cascade fallback)
    2. Extract embeddings with face_recognition
    3. Match against enrolled students
    4. Determine event type (ENTRY/SEEN/EXIT)

    Returns a tuple: (list of event dicts, list of bounding_box dicts).
    """
    events = []
    bounding_boxes = []
    now = datetime.utcnow()

    try:
        return _process_frame_inner(frame, camera_id, events, bounding_boxes, now)
    except Exception as e:
        logger.error("process_frame crashed: %s", e, exc_info=True)
        return events, bounding_boxes


def _process_frame_inner(frame, camera_id, events, bounding_boxes, now):

    # ── Apply histogram equalization for low-light improvement ──────
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    enhanced_frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # ── Resize for speed (process at half resolution) ───────────────
    small_frame = cv2.resize(enhanced_frame, (0, 0), fx=0.5, fy=0.5)

    # ── Strategy 1: MediaPipe detection + face_recognition encoding ─
    face_locations = _detect_faces_mediapipe(small_frame)

    if face_locations:
        logger.debug("MediaPipe detected %d face(s)", len(face_locations))
        try:
            import face_recognition
            rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            try:
                face_encodings = face_recognition.face_encodings(rgb, face_locations)
            except Exception as e:
                logger.warning("face_encodings failed: %s — showing boxes without identity", e)
                # Still show the boxes even if encoding failed
                for location in face_locations:
                    top, right, bottom, left = [coord * 2 for coord in location]
                    bounding_boxes.append({
                        "usn": "Unknown",
                        "box": [top, right, bottom, left],
                        "status": "UNKNOWN"
                    })
                return events, bounding_boxes
        except ImportError:
            # MediaPipe detected faces but no face_recognition for encoding
            logger.debug("face_recognition not installed — showing as Unknown")
            for location in face_locations:
                top, right, bottom, left = [coord * 2 for coord in location]
                bounding_boxes.append({
                    "usn": "Unknown",
                    "box": [top, right, bottom, left],
                    "status": "UNKNOWN"
                })
            return events, bounding_boxes
    else:
        # ── Strategy 2: Full face_recognition (dlib) ────────────────
        try:
            import face_recognition
            rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb, model="hog")
            face_encodings = face_recognition.face_encodings(rgb, face_locations)
            if face_locations:
                logger.debug("dlib HOG detected %d face(s)", len(face_locations))
        except ImportError:
            # ── Strategy 3: Haar cascade fallback ───────────────────
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            if len(faces) > 0:
                logger.debug("Haar cascade detected %d face(s)", len(faces))
            for (x, y, w, h) in faces:
                bounding_boxes.append({
                    "usn": "Unknown",
                    "box": [int(y*2), int((x+w)*2), int((y+h)*2), int(x*2)],
                    "status": "UNKNOWN"
                })
            return events, bounding_boxes

    # ── Match each detected face ────────────────────────────────────
    seen_usns = set()
    for encoding, location in zip(face_encodings, face_locations):
        usn, distance = recognition.match(encoding)
        confidence = max(0.0, 1.0 - distance) if distance < 1.0 else 0.0
        top, right, bottom, left = [coord * 2 for coord in location]

        # ── Liveness check on the face crop ──
        face_crop = frame[max(0,top):min(frame.shape[0],bottom), max(0,left):min(frame.shape[1],right)]
        face_id = usn if usn else f"unknown_{id(encoding) % 10000}"
        liveness_result = liveness_checker.check_liveness(face_crop, face_id)

        if usn is not None:
            if not liveness_result["is_live"]:
                # Spoofing detected — flag but don't count as attendance
                logger.warning("SPOOF detected for %s: %s (score=%.2f)", usn, liveness_result["details"], liveness_result["score"])
                bounding_boxes.append({
                    "usn": f"{usn} [SPOOF]",
                    "box": [top, right, bottom, left],
                    "status": "SPOOF",
                    "liveness": liveness_result["score"],
                })
                continue

            seen_usns.add(usn)
            if usn in _active_tracks:
                event_type = "SEEN"
            else:
                event_type = "ENTRY"
                logger.info("ENTRY detected: %s (confidence: %.2f, liveness: %.2f)", usn, confidence, liveness_result["score"])

            _active_tracks[usn] = now
            events.append({
                "usn": usn,
                "event_type": event_type,
                "camera_id": camera_id,
                "confidence": round(confidence, 4),
                "event_time": now.isoformat(),
            })
            bounding_boxes.append({
                "usn": usn,
                "box": [top, right, bottom, left],
                "status": "KNOWN",
                "liveness": liveness_result["score"],
            })
        else:
            logger.debug("Unmatched face detected (best distance: %.3f)", distance)
            bounding_boxes.append({
                "usn": "Unknown",
                "box": [top, right, bottom, left],
                "status": "UNKNOWN",
                "liveness": liveness_result["score"],
            })

    # ── Check for EXITs ─────────────────────────────────────────────
    gone_usns = []
    for usn, last_seen in _active_tracks.items():
        if usn not in seen_usns and (now - last_seen) > _GONE_THRESHOLD:
            gone_usns.append(usn)
            events.append({
                "usn": usn,
                "event_type": "EXIT",
                "camera_id": camera_id,
                "confidence": None,
                "event_time": now.isoformat(),
            })
            logger.info("EXIT detected: %s (not seen for %.0fs)", usn, (now - last_seen).total_seconds())

    for usn in gone_usns:
        del _active_tracks[usn]

    return events, bounding_boxes


def reset_tracks():
    """Clear all active tracks (e.g., at start of a new session)."""
    _active_tracks.clear()
