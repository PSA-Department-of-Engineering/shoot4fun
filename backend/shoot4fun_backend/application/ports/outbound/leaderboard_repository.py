"""Outbound port: leaderboard storage (P2, `LDR-002`).

The contract is a *per-arena* best-score store: one row per arena,
upserting only when the new score beats the existing one. The MVP
implementation is in-memory; the production implementation is asyncpg
against the platform-minted `pg-app-shoot4fun` role. A score may carry
a `user_id` reference to a profile (issue #12); `None` is a guest
score, name-only.
"""
from __future__ import annotations

from typing import Protocol

from shoot4fun_backend.domain.model.leaderboard_entry import LeaderboardEntry

__all__ = ["LeaderboardRepository"]


class LeaderboardRepository(Protocol):
    async def get_best(self, arena: str) -> LeaderboardEntry | None: ...
    async def upsert_if_higher(
        self,
        arena: str,
        holder_name: str,
        score: int,
        user_id: str | None = None,
    ) -> LeaderboardEntry: ...
    async def list_top(self, arena: str, limit: int = 10) -> list[LeaderboardEntry]: ...
