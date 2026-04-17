import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.auth import get_jwt_secret, verify_token
from app.services.log_broadcaster import broadcaster

router = APIRouter(tags=["websocket"])


def _check_ws_token(token: str | None) -> bool:
    if not token:
        return False
    return verify_token(token, get_jwt_secret())


@router.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket, token: str | None = Query(None)):
    if not _check_ws_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    queue = broadcaster.subscribe()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(msg))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        broadcaster.unsubscribe(queue)


@router.websocket("/ws/run/{run_id}")
async def ws_run(websocket: WebSocket, run_id: str, token: str | None = Query(None)):
    if not _check_ws_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    queue = broadcaster.subscribe()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                if msg.get("run_id") == run_id or msg.get("type") == "ping":
                    await websocket.send_text(json.dumps(msg))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        broadcaster.unsubscribe(queue)
