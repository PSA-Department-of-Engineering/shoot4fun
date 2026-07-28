"""Inbound port: the match service.

The single application surface the inbound adapters talk to. The HTTP
WebSocket adapter translates client messages into method calls here; the
HTTP `leaderboard` adapter calls the read methods; nothing else in the
application service is reachable from the network edge.
"""
from __future__ import annotations

from typing import Protocol

__all__ = ["MatchServicePort"]


class MatchServicePort(Protocol):
    async def connect(
        self, room_id: str, player_name: str
    ) -> tuple[str, dict]: ...
    async def disconnect(self, room_id: str, player_id: str) -> None: ...
    async def handle_message(self, room_id: str, player_id: str, msg: dict) -> None: ...
    async def tick_all(self) -> None: ...
    async def get_leaderboard(self, arena: str) -> dict | None: ...
    async def record_match_score(self, arena: str, holder_name: str, score: int) -> dict: ...
