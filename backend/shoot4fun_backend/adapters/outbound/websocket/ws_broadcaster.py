"""WebSocket broadcaster.

Holds the (player_id -> send_fn) bindings; the `send_fn` is an
`awaitable` that the WebSocket handler registered when the player
connected. The match service calls `send_to_room` to broadcast to
everyone in a room and `send_to` to message a single player.

The broadcaster is the only state the WebSocket adapter exposes to
the application; the in-process room state never leaves the
application service.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from shoot4fun_backend.application.ports.outbound.broadcaster import Broadcaster
from shoot4fun_backend.logging import get_logger

__all__ = ["WebSocketBroadcaster"]


SendFn = Callable[[dict], Awaitable[None]]
_log = get_logger("broadcaster")


class WebSocketBroadcaster(Broadcaster):
    def __init__(self) -> None:
        self._send_fns: dict[str, SendFn] = {}
        self._player_room: dict[str, str] = {}
        self._room_players: dict[str, set[str]] = defaultdict(set)
        self._close_fns: dict[str, Callable[[int, str], Awaitable[None]]] = {}

    def bind(
        self,
        player_id: str,
        room_id: str,
        send_fn: Any,
        close_fn: Any = None,
    ) -> None:
        self._send_fns[player_id] = send_fn
        self._player_room[player_id] = room_id
        self._room_players[room_id].add(player_id)
        if close_fn is not None:
            self._close_fns[player_id] = close_fn

    def unbind(self, player_id: str) -> None:
        room_id = self._player_room.pop(player_id, None)
        self._send_fns.pop(player_id, None)
        self._close_fns.pop(player_id, None)
        if room_id is not None:
            self._room_players[room_id].discard(player_id)
            if not self._room_players[room_id]:
                self._room_players.pop(room_id, None)

    def players_in_room(self, room_id: str) -> set[str]:
        return set(self._room_players.get(room_id, set()))

    async def send_state(self, room_id: str, state: dict) -> None:
        await self.send_to_room(room_id, {"type": "state", "room": state})

    async def send_to(self, player_id: str, message: dict) -> None:
        send = self._send_fns.get(player_id)
        if send is None:
            return
        try:
            await send(message)
        except Exception:
            _log.exception("send_to %s failed", player_id)
            self.unbind(player_id)

    async def send_to_room(self, room_id: str, message: dict) -> None:
        players = list(self._room_players.get(room_id, set()))
        if not players:
            return
        results = await asyncio.gather(
            *(self.send_to(p, message) for p in players),
            return_exceptions=True,
        )
        for r in results:
            if isinstance(r, Exception):
                _log.exception("send_to_room %s: %s", room_id, r)

    async def close_player(self, player_id: str, code: int, reason: str) -> None:
        close = self._close_fns.get(player_id)
        if close is None:
            return
        try:
            await close(code, reason)
        except Exception:
            _log.exception("close_player %s failed", player_id)
        finally:
            self.unbind(player_id)
