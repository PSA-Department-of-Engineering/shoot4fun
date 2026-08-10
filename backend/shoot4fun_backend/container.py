"""Composition root.

Builds the application service with the in-memory or Postgres
backends depending on the runtime environment. The `start()` and
`stop()` methods manage the leaderboard pool and the tick loop.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

from fastapi import WebSocket

from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
    InMemoryAccountRepository,
)
from shoot4fun_backend.adapters.outbound.memory.in_memory_leaderboard_repository import (
    InMemoryLeaderboardRepository,
)
from shoot4fun_backend.adapters.outbound.memory.in_memory_room_repository import (
    InMemoryRoomRepository,
)
from shoot4fun_backend.adapters.outbound.websocket.ws_broadcaster import (
    WebSocketBroadcaster,
)
from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.application.ports.outbound.broadcaster import Broadcaster
from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.application.ports.outbound.room_repository import RoomRepository
from shoot4fun_backend.application.services.account_service import AccountService
from shoot4fun_backend.application.services.guess_budget import GuessBudget
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
        self._accounts: AccountRepository = self._build_accounts()
        self._match_service: MatchService = MatchService(
            rooms=self._room_repo,
            broadcaster=self._broadcaster,
            leaderboard=self._leaderboard,
        )
        self._account_service: AccountService = AccountService(accounts=self._accounts)
        self._guess_budget: GuessBudget = GuessBudget()

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

    def _build_accounts(self) -> AccountRepository:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            _log.warning(
                "DATABASE_URL unset - using in-memory accounts; "
                "sessions and profiles will not survive a restart"
            )
            return InMemoryAccountRepository()
        from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (
            PostgresAccountRepository,
        )
        return PostgresAccountRepository(dsn)

    def match_service(self) -> MatchService:
        return self._match_service

    def account_service(self) -> AccountService:
        return self._account_service

    def guess_budget(self) -> GuessBudget:
        return self._guess_budget

    def room_repo(self) -> RoomRepository:
        return self._room_repo

    def broadcaster(self) -> Broadcaster:
        return self._broadcaster

    def leaderboard(self) -> LeaderboardRepository:
        return self._leaderboard

    async def start(self) -> None:
        for backend in (self._leaderboard, self._accounts):
            connect = getattr(backend, "connect", None)
            if callable(connect):
                await connect()
        if os.environ.get("DISABLE_TICK_LOOP") != "1":
            self._match_service.start_tick()

    async def stop(self) -> None:
        await self._match_service.stop_tick()
        for backend in (self._leaderboard, self._accounts):
            close = getattr(backend, "close", None)
            if callable(close):
                await close()

    async def handle_match(self, websocket: WebSocket, room_id: str) -> None:
        from shoot4fun_backend.adapters.inbound.websocket.match_socket import (
            handle_match_socket,
        )
        await handle_match_socket(websocket, room_id, self)
