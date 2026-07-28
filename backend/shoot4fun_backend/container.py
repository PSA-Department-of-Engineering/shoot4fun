"""Composition root.

Builds the application service with the in-memory or Postgres
backends depending on the runtime environment. The `start()` and
`stop()` methods manage the leaderboard pool and the tick loop.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

from fastapi import WebSocket

from shoot4fun_backend.adapters.outbound.memory.in_memory_leaderboard_repository import (
    InMemoryLeaderboardRepository,
)
from shoot4fun_backend.adapters.outbound.memory.in_memory_room_repository import (
    InMemoryRoomRepository,
)
from shoot4fun_backend.adapters.outbound.websocket.ws_broadcaster import (
    WebSocketBroadcaster,
)
from shoot4fun_backend.application.ports.outbound.broadcaster import Broadcaster
from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.application.ports.outbound.room_repository import RoomRepository
from shoot4fun_backend.application.services.match_service import MatchService
from shoot4fun_backend.logging import get_logger

if TYPE_CHECKING:
    pass

__all__ = ["Container"]


_log = get_logger("container")


class Container:
    """Wires the outbound adapters, the use cases, and the inbound adapters."""

    def __init__(self) -> None:
        self._room_repo: RoomRepository = InMemoryRoomRepository()
        self._broadcaster: Broadcaster = WebSocketBroadcaster()
        self._leaderboard: LeaderboardRepository = self._build_leaderboard()
        self._match_service: MatchService = MatchService(
            rooms=self._room_repo,
            broadcaster=self._broadcaster,
            leaderboard=self._leaderboard,
        )

    def _build_leaderboard(self) -> LeaderboardRepository:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            _log.warning(
                "DATABASE_URL unset - using in-memory leaderboard; "
                "LDR-002 will not persist across restarts"
            )
            return InMemoryLeaderboardRepository()
        from shoot4fun_backend.adapters.outbound.postgres.postgres_leaderboard_repository import (
            PostgresLeaderboardRepository,
        )
        return PostgresLeaderboardRepository(dsn)

    def match_service(self) -> MatchService:
        return self._match_service

    def room_repo(self) -> RoomRepository:
        return self._room_repo

    def broadcaster(self) -> Broadcaster:
        return self._broadcaster

    def leaderboard(self) -> LeaderboardRepository:
        return self._leaderboard

    async def start(self) -> None:
        leaderboard = self._leaderboard
        connect = getattr(leaderboard, "connect", None)
        if callable(connect):
            await connect()
        if os.environ.get("DISABLE_TICK_LOOP") != "1":
            self._match_service.start_tick()

    async def stop(self) -> None:
        await self._match_service.stop_tick()
        leaderboard = self._leaderboard
        close = getattr(leaderboard, "close", None)
        if callable(close):
            await close()

    async def handle_match(self, websocket: WebSocket, room_id: str) -> None:
        from shoot4fun_backend.adapters.inbound.websocket.match_socket import (
            handle_match_socket,
        )
        await handle_match_socket(websocket, room_id, self)
