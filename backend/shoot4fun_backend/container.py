"""Composition root.

Builds the application services with the in-memory or Postgres
backends depending on the runtime environment. The `start()` and
`stop()` methods manage the leaderboard and profile pools and the tick
loop.
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
from shoot4fun_backend.adapters.outbound.memory.in_memory_user_repository import (
    InMemoryUserRepository,
)
from shoot4fun_backend.adapters.outbound.websocket.ws_broadcaster import (
    WebSocketBroadcaster,
)
from shoot4fun_backend.application.ports.outbound.broadcaster import Broadcaster
from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.application.ports.outbound.room_repository import RoomRepository
from shoot4fun_backend.application.ports.outbound.user_repository import UserRepository
from shoot4fun_backend.application.services.match_service import MatchService
from shoot4fun_backend.application.services.profile_service import ProfileService
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
        self._users: UserRepository = self._build_users()
        self._profile_service: ProfileService = ProfileService(users=self._users)
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

    def _build_users(self) -> UserRepository:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            _log.warning(
                "DATABASE_URL unset - using in-memory user repository; "
                "profiles will not persist across restarts"
            )
            return InMemoryUserRepository()
        from shoot4fun_backend.adapters.outbound.postgres.postgres_user_repository import (
            PostgresUserRepository,
        )
        return PostgresUserRepository(dsn)

    def match_service(self) -> MatchService:
        return self._match_service

    def room_repo(self) -> RoomRepository:
        return self._room_repo

    def broadcaster(self) -> Broadcaster:
        return self._broadcaster

    def leaderboard(self) -> LeaderboardRepository:
        return self._leaderboard

    def profile_service(self) -> ProfileService:
        return self._profile_service

    async def start(self) -> None:
        # The leaderboard's `user_id` column references `users(id)`, so
        # the users table must exist before the leaderboard connects.
        users = self._users
        users_connect = getattr(users, "connect", None)
        if callable(users_connect):
            await users_connect()
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
        users = self._users
        users_close = getattr(users, "close", None)
        if callable(users_close):
            await users_close()

    async def handle_match(self, websocket: WebSocket, room_id: str) -> None:
        from shoot4fun_backend.adapters.inbound.websocket.match_socket import (
            handle_match_socket,
        )
        await handle_match_socket(websocket, room_id, self)
