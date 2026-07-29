"""The WebSocket match endpoint.

Translates the wire protocol to `MatchService` calls. The
`bind`/`unbind` calls wire the player's `send` and `close` into the
broadcaster so the service can push state without holding a
reference to the WebSocket.

The `ROOM_FULL` contract (`INT-008`) is enforced here: when
`MatchService.connect` raises `RoomFullError`, the server sends a
documented error message and closes with code 4409.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

from fastapi import WebSocket, WebSocketDisconnect

from shoot4fun_backend.domain.exceptions.room_full_error import RoomFullError
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.logging import get_logger

if TYPE_CHECKING:
    from shoot4fun_backend.container import Container


_log = get_logger("match_socket")


async def handle_match_socket(
    websocket: WebSocket, room_id: str, container: Container
) -> None:
    await websocket.accept()
    service = container.match_service()
    broadcaster = container.broadcaster()

    player_id = ""
    try:
        hello_raw = await websocket.receive_text()
        hello = json.loads(hello_raw)
        if hello.get("type") != "hello":
            await websocket.send_json({"type": "error", "code": "BAD_HELLO"})
            await websocket.close(code=4400, reason="expected {type: hello}")
            return
        name = str(hello.get("name", "anon"))[:32]

        async def send_fn(msg: dict) -> None:
            await websocket.send_json(msg)

        async def close_fn(code: int, reason: str) -> None:
            await websocket.close(code=code, reason=reason)

        try:
            player_id, snapshot = await service.connect(room_id, name)
        except RoomFullError as exc:
            await websocket.send_json(
                {"type": "error", "code": "ROOM_FULL", "detail": str(exc)}
            )
            await websocket.close(code=4409, reason="room full")
            return
        broadcaster.bind(player_id, room_id, send_fn, close_fn)
        await broadcaster.send_to(
            player_id, {"type": "hello", "player_id": player_id}
        )
        # The client learns which room it joined only from a snapshot message,
        # and while the room sits in LOBBY the tick loop broadcasts nothing
        # (MatchService.tick_all sends only for PLAYING/RESULTS). Without this
        # the client's onState never fires, so the lobby never renders and no
        # player can ready up or start the match: the scene stays an empty sky
        # behind a default HUD. Sent to the whole room rather than the joiner
        # alone, so existing players see the arrival and the host's all-ready
        # gate recomputes; the player_joined broadcast inside connect() cannot
        # do this, as it runs before the joiner is bound.
        if snapshot.get("state") == MatchState.LOBBY.value:
            await broadcaster.send_to_room(
                room_id, {"type": "lobby_state", "room": snapshot}
            )

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "code": "BAD_JSON"}
                )
                continue
            await service.handle_message(room_id, player_id, msg)
    except WebSocketDisconnect:
        _log.info("ws_disconnect room=%s player=%s", room_id, player_id)
    except Exception:
        _log.exception("match_socket crashed room=%s player=%s", room_id, player_id)
    finally:
        if player_id:
            await service.disconnect(room_id, player_id)
