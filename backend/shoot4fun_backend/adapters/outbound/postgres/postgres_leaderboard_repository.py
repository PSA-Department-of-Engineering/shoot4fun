"""Postgres `LeaderboardRepository`.

Backs the `LDR-002` claim with the platform's per-app database role
(`pg-app-shoot4fun`). The schema is a single `leaderboard` table with
one row per arena, upserted on the `best_score` column.

The DSN comes from `DATABASE_URL`; the platform mounts it via the
secret-plus-reflector mirror scoped to the `shoot4fun` namespace. A
missing DSN is a startup error (the contract is the platform-minted
credential, not a fallback to the in-memory store).
"""
from __future__ import annotations

import asyncpg

from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.domain.model.leaderboard_entry import LeaderboardEntry
from shoot4fun_backend.logging import get_logger

__all__ = ["PostgresLeaderboardRepository"]


_log = get_logger("postgres_leaderboard")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS leaderboard (
    arena TEXT PRIMARY KEY,
    best_score INTEGER NOT NULL,
    holder_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


class PostgresLeaderboardRepository(LeaderboardRepository):
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=4)
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA)
        _log.info("postgres_leaderboard connected")

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def get_best(self, arena: str) -> LeaderboardEntry | None:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT arena, best_score, holder_name, updated_at "
                "FROM leaderboard WHERE arena = $1",
                arena,
            )
        if row is None:
            return None
        return LeaderboardEntry(
            arena=row["arena"],
            best_score=row["best_score"],
            holder_name=row["holder_name"],
            updated_at=row["updated_at"].isoformat(),
        )

    async def upsert_if_higher(
        self, arena: str, holder_name: str, score: int
    ) -> LeaderboardEntry:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO leaderboard (arena, best_score, holder_name, updated_at)
                VALUES ($1, $2, $3, now())
                ON CONFLICT (arena) DO UPDATE
                  SET best_score = EXCLUDED.best_score,
                      holder_name = EXCLUDED.holder_name,
                      updated_at = now()
                  WHERE EXCLUDED.best_score > leaderboard.best_score
                RETURNING arena, best_score, holder_name, updated_at
                """,
                arena,
                score,
                holder_name,
            )
        if row is None:
            existing = await self.get_best(arena)
            assert existing is not None, "upsert returned no row and get_best too"
            return existing
        return LeaderboardEntry(
            arena=row["arena"],
            best_score=row["best_score"],
            holder_name=row["holder_name"],
            updated_at=row["updated_at"].isoformat(),
        )

    async def list_top(self, arena: str, limit: int = 10) -> list[LeaderboardEntry]:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT arena, best_score, holder_name, updated_at "
                "FROM leaderboard WHERE arena = $1 "
                "ORDER BY best_score DESC LIMIT $2",
                arena,
                limit,
            )
        return [
            LeaderboardEntry(
                arena=r["arena"],
                best_score=r["best_score"],
                holder_name=r["holder_name"],
                updated_at=r["updated_at"].isoformat(),
            )
            for r in rows
        ]
