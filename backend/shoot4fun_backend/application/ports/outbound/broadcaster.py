"""Outbound port: the broadcaster.

The `Broadcaster` pushes state to clients over the WebSocket transport.
The application service calls it; the WebSocket adapter implements it.
The protocol is async because the broadcaster is the boundary between
the in-process room state and the network edge.
"""
from __future__ import annotations

from typing import Any, Protocol

__all__ = ["Broadcaster"]


class Broadcaster(Protocol):
    async def send_state(self, room_id: str, state: dict) -> None: ...
    async def send_to(self, player_id: str, message: dict) -> None: ...
    async def send_to_room(self, room_id: str, message: dict) -> None: ...
    async def close_player(self, player_id: str, code: str, reason: str) -> None: ...
    def bind(
        self, player_id: str, room_id: str, send_fn: Any
    ) -> None: ...
    def unbind(self, player_id: str) -> None: ...
