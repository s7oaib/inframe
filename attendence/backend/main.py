"""
Inframe MVP — FastAPI Application Entry Point

Serves the backend API and the landing page as a static file.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .database import init_db, get_db, User, SessionLocal
from .services import recognition
from .services.auth import get_password_hash
from .routes import events, persons, attendance, sessions, auth, analytics, exports, schedule, student_portal
from .websockets import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def seed_admin():
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin"),
                role="admin"
            )
            db.add(admin)
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.warning(f"Could not seed admin user (might already exist): {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # Startup
    logger.info("Initializing database...")
    init_db()
    seed_admin()
    logger.info("Loading enrolled face embeddings...")
    recognition.init_embeddings_dir()
    recognition.load_all_embeddings()
    logger.info(
        "Ready — %d enrolled students, staleness threshold = %d min",
        recognition.get_enrolled_count(),
        settings.ABSENT_GAP_MINUTES,
    )
    yield
    # Shutdown
    logger.info("Shutting down Inframe backend.")


app = FastAPI(
    title="Inframe — AI Classroom Attendance",
    description=(
        "CCTV-based facial recognition attendance system. "
        "Phase 1 MVP: single classroom, single camera, instructor-reviewed."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routes ──
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(persons.router)
app.include_router(attendance.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(exports.router)
app.include_router(schedule.router)
app.include_router(student_portal.router)


# ── WebSockets ──

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Dashboard main websocket for real-time attendance updates."""
    await manager.connect(websocket)
    try:
        while True:
            # We just keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/live/{camera_id}")
async def live_feed_endpoint(websocket: WebSocket, camera_id: str):
    """Dashboard websocket for subscribing to live camera frames."""
    await manager.connect_live_feed(websocket, camera_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_live_feed(websocket, camera_id)


# ── Landing page ──
LANDING_PAGE = Path(__file__).parent.parent / "landing-page.html"
if not LANDING_PAGE.exists():
    LANDING_PAGE = Path(__file__).parent.parent.parent / "landing-page.html"


@app.get("/", include_in_schema=False)
async def serve_landing_page():
    """Serve the landing page at root."""
    if LANDING_PAGE.exists():
        return FileResponse(str(LANDING_PAGE), media_type="text/html")
    return {"message": "Inframe API is running. Visit /docs for API documentation."}


@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "enrolled_count": recognition.get_enrolled_count(),
        "config": {
            "absent_gap_minutes": settings.ABSENT_GAP_MINUTES,
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "camera_id": settings.CAMERA_ID,
        },
    }
