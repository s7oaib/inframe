"""
Inframe MVP — Edge Camera Capture Loop (MJPEG + Box WebSocket)

Architecture:
  :8081  →  MJPEG HTTP stream (binary frames, native browser rendering)
  :8082  →  WebSocket for bounding boxes only (tiny JSON, ~200 bytes)
  HTTP   →  Events only (ENTRY/EXIT/SEEN) to FastAPI backend

No base64 encoding. No frame relay through backend. Direct to browser.
"""

import time
import logging
import json
import asyncio
import threading
from collections import deque

from ..config import settings

logger = logging.getLogger(__name__)

# ── Shared state ────────────────────────────────────────────────────────
_lock = threading.Lock()
_frame_ready = threading.Event()  # Signals MJPEG server instantly when new frame arrives
state = {
    "latest_frame": None,
    "latest_boxes": [],
    "latest_jpeg": b'',
    "running": True,
    "jpeg_quality": 65,
}


# ── Multi-threaded frame capture ────────────────────────────────────────
class CameraGrabber(threading.Thread):
    """Dedicated thread that continuously grabs frames from the camera hardware."""
    def __init__(self, cap, target_fps=30):
        super().__init__(daemon=True)
        self.cap = cap
        self.frame = None
        self.ret = False
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def run(self):
        while not self._stop_event.is_set():
            ret, frame = self.cap.read()
            with self._lock:
                self.ret = ret
                self.frame = frame
            if not ret:
                time.sleep(0.01)

    def read(self):
        with self._lock:
            return self.ret, self.frame.copy() if self.frame is not None else None

    def stop(self):
        self._stop_event.set()


# ── Box WebSocket Server (:8082) ────────────────────────────────────────
_ws_clients = set()
_ws_loop = None

async def _ws_handler(websocket, path=None):
    """Handle a single WebSocket client for box updates."""
    _ws_clients.add(websocket)
    logger.info("Box WS client connected (%d total)", len(_ws_clients))
    try:
        async for _ in websocket:
            pass  # We only send, never receive
    except Exception:
        pass
    finally:
        _ws_clients.discard(websocket)
        logger.info("Box WS client disconnected (%d remaining)", len(_ws_clients))


def _broadcast_boxes(boxes):
    """Send box data to all connected WebSocket clients."""
    if not _ws_clients or _ws_loop is None:
        return
    msg = json.dumps({"boxes": boxes})
    # Schedule broadcast on the WS event loop
    asyncio.run_coroutine_threadsafe(_do_broadcast(msg), _ws_loop)


async def _do_broadcast(msg):
    """Actually send to all clients (runs on the WS event loop)."""
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


def _start_ws_server(port=8082):
    """Start the box WebSocket server in its own asyncio event loop."""
    global _ws_loop
    import websockets

    async def serve():
        global _ws_loop
        _ws_loop = asyncio.get_event_loop()
        async with websockets.serve(_ws_handler, "0.0.0.0", port):
            logger.info("Box WebSocket server on ws://localhost:%d", port)
            await asyncio.Future()  # Run forever

    asyncio.run(serve())


# ── MJPEG Streaming Server (:8081) ──────────────────────────────────────
def _start_mjpeg_server(port=8081):
    """Serve MJPEG at /mjpeg — browsers render this natively in an <img> tag."""
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

    class MJPEGHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/mjpeg':
                self.send_response(200)
                self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                try:
                    while state["running"]:
                        # Wait for a new frame (blocks until notified — no polling!)
                        _frame_ready.wait(timeout=1.0)
                        _frame_ready.clear()
                        with _lock:
                            jpeg = state["latest_jpeg"]
                        if jpeg:
                            self.wfile.write(b'--frame\r\n')
                            self.wfile.write(b'Content-Type: image/jpeg\r\n')
                            self.wfile.write(f'Content-Length: {len(jpeg)}\r\n\r\n'.encode())
                            self.wfile.write(jpeg)
                            self.wfile.write(b'\r\n')
                except (BrokenPipeError, ConnectionResetError):
                    pass
            elif self.path == '/':
                # Health check
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'MJPEG server running')
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):
            pass

    server = ThreadingHTTPServer(('0.0.0.0', port), MJPEGHandler)
    logger.info("MJPEG stream at http://localhost:%d/mjpeg", port)
    server.serve_forever()


# ── Main Capture Loop ───────────────────────────────────────────────────
def run_capture_loop():
    try:
        import cv2
    except ImportError:
        logger.warning("opencv-python not found. Starting MOCK camera mode.")
        run_mock_loop()
        return

    import cv2
    from .detector import process_frame
    from .reporter import report_event

    camera_id = settings.CAMERA_ID
    device = settings.CAMERA_DEVICE_INDEX
    interval = settings.CAPTURE_INTERVAL_SECONDS

    logger.info("Camera module starting — opening hardware immediately...")
    cap = cv2.VideoCapture(device)
    if not cap.isOpened():
        logger.warning("Failed to open camera %s. Falling back to MOCK.", device)
        run_mock_loop()
        return

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)

    grabber = CameraGrabber(cap, target_fps=30)
    grabber.start()
    logger.info("Multi-threaded frame grabber started")

    # ── Detection worker (processes frames, broadcasts boxes) ───────
    def detection_worker():
        while state["running"]:
            with _lock:
                frame = state["latest_frame"]

            if frame is None:
                time.sleep(0.1)
                continue

            events, boxes = process_frame(frame, camera_id)

            with _lock:
                state["latest_boxes"] = boxes

            # Broadcast boxes to all WebSocket clients
            _broadcast_boxes(boxes)

            # Report events (ENTRY/EXIT/SEEN) to backend
            for event in events:
                report_event(event)

            time.sleep(interval)

    det_thread = threading.Thread(target=detection_worker, daemon=True)
    det_thread.start()

    # ── Performance tracking ────────────────────────────────────────
    frame_times = deque(maxlen=30)
    last_quality_adjust = 0

    try:
        while state["running"]:
            now = time.time()

            ret, frame = grabber.read()
            if frame is None or not ret:
                time.sleep(0.03)
                continue

            frame_start = time.time()

            # Standardize to 640x480
            frame = cv2.resize(frame, (640, 480))

            # Update shared state (for detection worker)
            with _lock:
                state["latest_frame"] = frame.copy()

            # JPEG encode → push to MJPEG buffer
            quality = state["jpeg_quality"]
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])

            with _lock:
                state["latest_jpeg"] = buffer.tobytes()
            _frame_ready.set()  # Wake MJPEG server instantly

            # Adaptive quality
            elapsed = time.time() - frame_start
            frame_times.append(elapsed)

            if now - last_quality_adjust > 2.0 and len(frame_times) >= 10:
                last_quality_adjust = now
                avg_time = sum(frame_times) / len(frame_times)
                if avg_time > 0.05:
                    state["jpeg_quality"] = max(40, quality - 5)
                elif avg_time < 0.02:
                    state["jpeg_quality"] = min(85, quality + 5)

            # Cap at 30fps
            time.sleep(max(0, (1.0 / 30.0) - elapsed))

    except KeyboardInterrupt:
        logger.info("Camera capture stopped by user.")
    finally:
        state["running"] = False
        grabber.stop()
        cap.release()
        logger.info("Camera released.")


# ── Mock Loop ───────────────────────────────────────────────────────────
def run_mock_loop():
    """Simulates camera for testing without a real webcam."""
    from .reporter import report_event
    from datetime import datetime
    import cv2
    import numpy as np

    interval = settings.CAPTURE_INTERVAL_SECONDS
    camera_id = settings.CAMERA_ID
    usns = ["1HK23AI048", "1HK23AI049"]

    logger.info("MOCK Camera started. Simulating for %s.", usns)

    dummy_frame = np.ones((480, 640, 3), dtype=np.uint8) * 100
    cv2.putText(dummy_frame, "MOCK CAMERA FEED", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    try:
        for usn in usns:
            report_event({
                "usn": usn, "event_type": "ENTRY", "camera_id": camera_id,
                "confidence": 0.99, "event_time": datetime.utcnow().isoformat()
            })

        frame_count = 0
        while True:
            offset_x = int(np.sin(frame_count * 0.1) * 50)
            mock_boxes = [
                {"usn": usns[0], "box": [100, 200 + offset_x, 250, 50 + offset_x], "status": "KNOWN"},
                {"usn": "Unknown", "box": [100, 500 - offset_x, 250, 350 - offset_x], "status": "UNKNOWN"}
            ]

            _, buffer = cv2.imencode('.jpg', dummy_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            with _lock:
                state["latest_jpeg"] = buffer.tobytes()

            _broadcast_boxes(mock_boxes)

            if frame_count % 30 == 0:
                for usn in usns:
                    report_event({
                        "usn": usn, "event_type": "SEEN", "camera_id": camera_id,
                        "confidence": 0.95, "event_time": datetime.utcnow().isoformat()
                    })
            frame_count += 1
            time.sleep(1.0 / 15.0)

    except KeyboardInterrupt:
        logger.info("Mock camera stopped.")


# ── Entry Point ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("attendence.backend.edge.detector").setLevel(logging.DEBUG)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    # Start MJPEG server (:8081)
    threading.Thread(target=_start_mjpeg_server, args=(8081,), daemon=True).start()

    # Start Box WebSocket server (:8082)
    threading.Thread(target=_start_ws_server, args=(8082,), daemon=True).start()

    # Give servers a moment to bind
    time.sleep(0.5)

    run_capture_loop()
