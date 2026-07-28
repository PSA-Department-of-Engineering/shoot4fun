"""In-memory `LeaderboardRepository`.

The MVP implementation; the production implementation lives in
`postgres_leaderboard_repository.py` and is selected by the container
when the `pg-app-shoot4fun` connection string is set.
"""
from __future__ import annotations

import datetime as _dt

from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.domain.model.leaderboard_entry import LeaderboardEntry

__all__ = ["InMemoryLeaderboardRepository"]


class InMemoryLeaderboardRepository(LeaderboardRepository):
    def __init__(self) -> None:
        self._best: dict[str, LeaderboardEntry] = {}

    async def get_best(self, arena: str) -> LeaderboardEntry | None:
        return self._best.get(arena)

    async def upsert_if_higher(
        self, arena: str, holder_name: str, score: int
    ) -> LeaderboardEntry:
        current = self._best.get(arena)
        if current is None or score > current.best_score:
            entry = LeaderboardEntry(
                arena=arena,
                best_score=score,
                holder_name=holder_name,
                updated_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
            )
            self._best[arena] = entry
            return entry
        return current

    async def list_top(self, arena: str, limit: int = 10) -> list[LeaderboardEntry]:
        entry = self._best.get(arena)
        return [entry] if entry else []
