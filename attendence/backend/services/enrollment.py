"""
Inframe MVP — Enrollment Service

CLI and programmatic enrollment: accept photos for a USN,
extract embeddings, and store them.
"""

import sys
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from . import recognition

logger = logging.getLogger(__name__)


def enroll_from_directory(usn: str, photo_dir: str) -> dict:
    """
    Enroll a student from a directory of photos.

    Args:
        usn: University Seat Number (e.g. '1HK23AI048')
        photo_dir: Path to directory containing 3-5 photos of the student

    Returns:
        dict with enrollment result
    """
    try:
        import cv2
    except ImportError:
        return {"success": False, "message": "opencv-python is required for enrollment"}

    photo_path = Path(photo_dir)
    if not photo_path.exists():
        return {"success": False, "message": f"Photo directory not found: {photo_dir}"}

    # Load all images from the directory
    supported_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    photos = []
    for img_file in sorted(photo_path.iterdir()):
        if img_file.suffix.lower() in supported_exts:
            img = cv2.imread(str(img_file))
            if img is not None:
                photos.append(img)
            else:
                logger.warning("Could not read image: %s", img_file)

    if len(photos) == 0:
        return {"success": False, "message": f"No valid images found in {photo_dir}"}

    if len(photos) < 3:
        logger.warning("Only %d photos provided for USN %s (3-5 recommended)", len(photos), usn)

    return recognition.enroll(usn, photos)


def enroll_from_upload(usn: str, file_bytes_list: list[bytes]) -> dict:
    """
    Enroll from uploaded file bytes (for the web API).

    Args:
        usn: University Seat Number
        file_bytes_list: List of image file contents as bytes

    Returns:
        dict with enrollment result
    """
    try:
        import cv2
    except ImportError:
        return {"success": False, "message": "opencv-python is required for enrollment"}

    photos = []
    for i, file_bytes in enumerate(file_bytes_list):
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            photos.append(img)
        else:
            logger.warning("Could not decode uploaded image %d for USN %s", i + 1, usn)

    if len(photos) == 0:
        return {"success": False, "message": "No valid images could be decoded from uploads"}

    return recognition.enroll(usn, photos)


# ── CLI entry point ──
def main():
    """
    CLI usage:
        python -m backend.services.enrollment --usn 1HK23AI048 --photos ./photos/048/
    """
    import argparse

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Enroll a student for face recognition")
    parser.add_argument("--usn", required=True, help="University Seat Number (e.g. 1HK23AI048)")
    parser.add_argument("--photos", required=True, help="Path to directory with 3-5 photos")

    args = parser.parse_args()
    recognition.init_embeddings_dir()

    result = enroll_from_directory(args.usn, args.photos)

    if result["success"]:
        print(f"✓ {result['message']}")
    else:
        print(f"✗ {result['message']}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
