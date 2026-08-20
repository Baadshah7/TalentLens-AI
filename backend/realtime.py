from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # rooms: room_id -> list of WebSocket
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        conns = self.rooms.setdefault(room_id, [])
        conns.append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        conns = self.rooms.get(room_id)
        if not conns:
            return
        try:
            conns.remove(websocket)
        except ValueError:
            pass
        if len(conns) == 0:
            # cleanup empty room
            self.rooms.pop(room_id, None)

    async def broadcast_text(self, room_id: str, message: str):
        conns = self.rooms.get(room_id, [])
        for ws in list(conns):
            try:
                await ws.send_text(message)
            except Exception:
                # ignore send errors
                pass

    async def broadcast_json(self, room_id: str, data):
        conns = self.rooms.get(room_id, [])
        for ws in list(conns):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()
