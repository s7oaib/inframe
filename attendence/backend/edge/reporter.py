"""
Inframe MVP — Edge Event Reporter

HTTP client that POSTs recognition events to the backend API.
Includes local queuing and retry for network failures.
"""

import logging
import json
from collections import deque
from datetime import datetime

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

# Local queue for events that failed to send (retry on next attempt)
_retry_queue: deque[dict] = deque(maxlen=500)

# HTTP client with timeout
_client = httpx.Client(
    base_url=settings.BACKEND_URL,
    timeout=5.0,
)


def report_event(event: dict) -> bool:
    """
    POST an event to the backend API.
    If the request fails, the event is queued for retry.
    """
    # Try to flush any previously failed events first
    _flush_retry_queue()

    try:
        response = _client.post("/api/v1/events", json=event)

        if response.status_code == 201:
            resolved = response.json().get("resolved_status", "?")
            logger.info(
                "→ %s %s reported (status: %s)",
                event["event_type"],
                event["usn"],
                resolved,
            )
            return True
        else:
            logger.warning(
                "Backend returned %d for event %s %s: %s",
                response.status_code,
                event["event_type"],
                event["usn"],
                response.text[:200],
            )
            _retry_queue.append(event)
            return False

    except httpx.ConnectError:
        logger.warning(
            "Cannot connect to backend at %s — queuing event for retry",
            settings.BACKEND_URL,
        )
        _retry_queue.append(event)
        return False

    except httpx.TimeoutException:
        logger.warning("Backend request timed out — queuing event for retry")
        _retry_queue.append(event)
        return False

    except Exception as e:
        logger.error("Unexpected error reporting event: %s", e)
        _retry_queue.append(event)
        return False


def _flush_retry_queue():
    """Attempt to send any queued events."""
    flushed = 0
    while _retry_queue:
        event = _retry_queue[0]
        try:
            response = _client.post("/api/v1/events", json=event)
            if response.status_code == 201:
                _retry_queue.popleft()
                flushed += 1
            else:
                break  # Stop flushing if backend is still unhappy
        except Exception:
            break  # Network still down, stop trying

    if flushed > 0:
        logger.info("Flushed %d queued events to backend", flushed)



def get_queue_size() -> int:
    """Number of events waiting in the retry queue."""
    return len(_retry_queue)
