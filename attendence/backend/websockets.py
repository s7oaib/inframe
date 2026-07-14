"""
Inframe MVP — WebSocket Connection Manager
"""

from fastapi import WebSocket
from typing import List, Dict

class ConnectionManager:
    def __init__(self):
        # Active connections for dashboard updates
        self.active_connections: List[WebSocket] = []
        # Active connections for live feed (keyed by session_id or camera_id)
        self.live_feed_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def connect_live_feed(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        if camera_id not in self.live_feed_connections:
            self.live_feed_connections[camera_id] = []
        self.live_feed_connections[camera_id].append(websocket)

    def disconnect_live_feed(self, websocket: WebSocket, camera_id: str):
        if camera_id in self.live_feed_connections:
            if websocket in self.live_feed_connections[camera_id]:
                self.live_feed_connections[camera_id].remove(websocket)

    async def broadcast_live_feed(self, camera_id: str, frame_data: str):
        if camera_id in self.live_feed_connections:
            for connection in self.live_feed_connections[camera_id]:
                try:
                    await connection.send_text(frame_data)
                except Exception:
                    pass

manager = ConnectionManager()
