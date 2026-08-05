import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import WebSocket

logger = logging.getLogger("ctip.websocket")


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts real-time threat intelligence events."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")
        # Send welcome/handshake message
        await self.send_personal_message(
            {
                "type": "CONNECTION_ESTABLISHED",
                "message": "Connected to CTIP Real-Time Defense Stream",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            websocket,
        )

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast JSON message to all active WebSocket clients."""
        if not self.active_connections:
            return

        if "timestamp" not in message:
            message["timestamp"] = datetime.now(timezone.utc).isoformat()

        payload = json.dumps(message)
        dead_connections: List[WebSocket] = []

        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to client ({e}); queueing for removal.")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    # ── Convenience Typed Broadcasters ───────────────────────────

    async def broadcast_threat_detected(self, threat_data: Dict[str, Any]) -> None:
        """Notify dashboards immediately when a suspicious/critical threat is detected."""
        await self.broadcast({
            "type": "THREAT_DETECTED",
            "data": threat_data,
        })

    async def broadcast_telemetry_event(self, event_data: Dict[str, Any]) -> None:
        """Broadcast browser extension actions (e.g. LOGIN_BLOCKED, WARNING_DISPLAYED)."""
        await self.broadcast({
            "type": "PROTECTION_EVENT",
            "data": event_data,
        })

    async def broadcast_threat_status(self, threat_id: int, status: str, notes: str | None = None) -> None:
        """Broadcast analyst status overrides (e.g. ACTIVE -> BLOCKED / RESOLVED)."""
        await self.broadcast({
            "type": "THREAT_STATUS_CHANGED",
            "data": {
                "threat_id": threat_id,
                "threat_status": status,
                "notes": notes,
            },
        })

    async def broadcast_digital_twin(self, twin_data: Dict[str, Any]) -> None:
        """Broadcast when an official digital twin is registered."""
        await self.broadcast({
            "type": "TWIN_CREATED",
            "data": twin_data,
        })

    async def broadcast_notification(self, notification_data: Dict[str, Any]) -> None:
        """Broadcast SOC alert notifications."""
        await self.broadcast({
            "type": "NOTIFICATION_CREATED",
            "data": notification_data,
        })


# Global singleton instance used throughout FastAPI app
ws_manager = ConnectionManager()
