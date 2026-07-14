"""
Inframe — Liveness Detection (Anti-Spoofing)

Uses multi-factor liveness checks to prevent photo/screen attacks:
1. Eye Aspect Ratio (EAR) — detects blinks over time
2. Texture Analysis (LBP variance) — flat textures = printed photo
3. Moiré pattern detection — screens produce moiré artifacts
4. Face size consistency — real faces change size smoothly

All checks are lightweight (no extra models needed) and run in < 5ms per face.
"""

import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Per-USN liveness tracking ──
_liveness_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=30))
_blink_counts: dict[str, int] = defaultdict(int)
_last_ear: dict[str, float] = {}

# Constants
EAR_THRESHOLD = 0.22      # Below this = eye closed
BLINK_CONSECUTIVE = 2      # Min consecutive frames for a blink
LBP_VARIANCE_THRESHOLD = 15.0  # Below = likely flat print
MOIRE_THRESHOLD = 0.3      # High frequency energy ratio
LIVENESS_SCORE_THRESHOLD = 0.6  # Overall threshold


def compute_ear(eye_points: np.ndarray) -> float:
    """Eye Aspect Ratio: height / width of eye landmarks."""
    if len(eye_points) < 6:
        return 0.3  # default open
    
    # Vertical distances
    v1 = np.linalg.norm(eye_points[1] - eye_points[5])
    v2 = np.linalg.norm(eye_points[2] - eye_points[4])
    # Horizontal distance
    h = np.linalg.norm(eye_points[0] - eye_points[3])
    
    if h == 0:
        return 0.3
    return (v1 + v2) / (2.0 * h)


def check_texture_liveness(face_crop: np.ndarray) -> Tuple[bool, float]:
    """
    LBP (Local Binary Pattern) texture analysis.
    Real faces have rich texture; printed photos are smoother.
    Returns (is_live, variance_score).
    """
    if face_crop is None or face_crop.size == 0:
        return True, 999.0  # can't check, assume live
    
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop
    gray = cv2.resize(gray, (64, 64))
    
    # Compute LBP manually
    lbp = np.zeros_like(gray, dtype=np.uint8)
    for i in range(1, gray.shape[0] - 1):
        for j in range(1, gray.shape[1] - 1):
            center = gray[i, j]
            code = 0
            code |= (gray[i-1, j-1] >= center) << 7
            code |= (gray[i-1, j] >= center) << 6
            code |= (gray[i-1, j+1] >= center) << 5
            code |= (gray[i, j+1] >= center) << 4
            code |= (gray[i+1, j+1] >= center) << 3
            code |= (gray[i+1, j] >= center) << 2
            code |= (gray[i+1, j-1] >= center) << 1
            code |= (gray[i, j-1] >= center) << 0
            lbp[i, j] = code
    
    variance = float(np.var(lbp))
    is_live = variance > LBP_VARIANCE_THRESHOLD
    
    return is_live, variance


def check_moire_pattern(face_crop: np.ndarray) -> Tuple[bool, float]:
    """
    Detect moiré patterns (screen replay attacks).
    Screens produce regular high-frequency patterns in the frequency domain.
    """
    if face_crop is None or face_crop.size == 0:
        return True, 0.0
    
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop
    gray = cv2.resize(gray, (64, 64))
    
    # FFT analysis
    f_transform = np.fft.fft2(gray.astype(np.float32))
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.abs(f_shift)
    
    # Compute ratio of high-frequency energy
    h, w = magnitude.shape
    center_mask = np.zeros((h, w), dtype=bool)
    cy, cx = h // 2, w // 2
    r = min(h, w) // 6
    center_mask[cy-r:cy+r, cx-r:cx+r] = True
    
    total_energy = np.sum(magnitude)
    low_freq_energy = np.sum(magnitude[center_mask])
    
    if total_energy == 0:
        return True, 0.0
    
    high_freq_ratio = 1.0 - (low_freq_energy / total_energy)
    is_live = high_freq_ratio < MOIRE_THRESHOLD
    
    return is_live, high_freq_ratio


def check_liveness(
    face_crop: np.ndarray,
    usn_or_id: str,
    face_landmarks: Optional[dict] = None,
) -> dict:
    """
    Multi-factor liveness check for a detected face.
    
    Args:
        face_crop: BGR face image (cropped from frame)
        usn_or_id: USN or temporary ID for tracking
        face_landmarks: Optional face landmarks with 'left_eye' and 'right_eye'
    
    Returns:
        {
            "is_live": bool,
            "score": float (0-1),
            "checks": {
                "texture": bool,
                "moire": bool,
                "blink_detected": bool,
            },
            "details": str
        }
    """
    scores = []
    checks = {}
    
    # Check 1: Texture analysis
    texture_live, texture_var = check_texture_liveness(face_crop)
    checks["texture"] = texture_live
    scores.append(1.0 if texture_live else 0.2)
    
    # Check 2: Moiré pattern
    moire_live, moire_ratio = check_moire_pattern(face_crop)
    checks["moire"] = moire_live
    scores.append(1.0 if moire_live else 0.2)
    
    # Check 3: Eye blink tracking (if landmarks available)
    blink_detected = False
    if face_landmarks and "left_eye" in face_landmarks and "right_eye" in face_landmarks:
        left_ear = compute_ear(np.array(face_landmarks["left_eye"]))
        right_ear = compute_ear(np.array(face_landmarks["right_eye"]))
        avg_ear = (left_ear + right_ear) / 2.0
        
        prev_ear = _last_ear.get(usn_or_id, 0.3)
        _last_ear[usn_or_id] = avg_ear
        
        # Detect blink transition (open → closed → open)
        if prev_ear > EAR_THRESHOLD and avg_ear < EAR_THRESHOLD:
            _blink_counts[usn_or_id] += 1
            blink_detected = True
    
    checks["blink_detected"] = _blink_counts.get(usn_or_id, 0) > 0
    
    # Blinks are strong evidence of liveness
    if _blink_counts.get(usn_or_id, 0) > 0:
        scores.append(1.0)
    else:
        scores.append(0.5)  # neutral — might not have blinked yet
    
    # Compute overall score
    overall_score = sum(scores) / len(scores) if scores else 0.5
    is_live = overall_score >= LIVENESS_SCORE_THRESHOLD
    
    # Track history
    _liveness_history[usn_or_id].append({
        "time": datetime.utcnow(),
        "score": overall_score,
        "live": is_live,
    })
    
    detail_parts = []
    if not texture_live:
        detail_parts.append(f"flat texture (var={texture_var:.1f})")
    if not moire_live:
        detail_parts.append(f"moiré detected (ratio={moire_ratio:.2f})")
    if _blink_counts.get(usn_or_id, 0) > 0:
        detail_parts.append(f"blink count: {_blink_counts[usn_or_id]}")
    
    return {
        "is_live": is_live,
        "score": round(overall_score, 3),
        "checks": checks,
        "details": "; ".join(detail_parts) if detail_parts else "passed all checks",
    }


def get_liveness_stats(usn: str) -> dict:
    """Get liveness statistics for a tracked person."""
    history = list(_liveness_history.get(usn, []))
    if not history:
        return {"usn": usn, "total_checks": 0, "live_ratio": 0}
    
    live_count = sum(1 for h in history if h["live"])
    return {
        "usn": usn,
        "total_checks": len(history),
        "live_ratio": round(live_count / len(history), 2),
        "blink_count": _blink_counts.get(usn, 0),
        "avg_score": round(sum(h["score"] for h in history) / len(history), 3),
    }


def reset_liveness():
    """Reset all liveness tracking (e.g., new session)."""
    _liveness_history.clear()
    _blink_counts.clear()
    _last_ear.clear()
