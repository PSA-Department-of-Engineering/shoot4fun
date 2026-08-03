"""Postgres `LeaderboardRepository`.

Backs the `LDR-002` claim with the platform's per-app database role
(`pg-app-shoot4fun`). The schema is a single `leaderboard` table with
one row per arena, upserted on the `best_score` column, carrying an
optional `user_id` reference to a profile (`users.id`, issue #12) so a
score is attributable once login lands; guest scores keep `NULL`.

The DSN comes from `DATABASE_URL`; the platform mounts it via the
secret-plus-reflector mirror scoped to the `shoot4fun` namespace. A
missing DSN is a startup error (the contract is the platform-minted
credential, not a fallback to the in-memory store). The `user_id`
foreign key references the `users` table, which the user repository
creates, so that repository must connect first (the container orders
the two in `start()`).
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
);
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
"""

_ENTRY_COLUMNS = "arena, best_score, holder_name, user_id, updated_at"


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
                f"SELECT {_ENTRY_COLUMNS} FROM leaderboard WHERE arena = $1",
                arena,
            )
        return _row_to_entry(row) if row is not None else None

    async def upsert_if_higher(
        self,
        arena: str,
        holder_name: str,
        score: int,
        user_id: str | None = None,
    ) -> LeaderboardEntry:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                INSERT INTO leaderboard (arena, best_score, holder_name, user_id, updated_at)
                VALUES ($1, $2, $3, $4, now())
                ON CONFLICT (arena) DO UPDATE
                  SET best_score = EXCLUDED.best_score,
                      holder_name = EXCLUDED.holder_name,
                      user_id = EXCLUDED.user_id,
                      updated_at = now()
                  WHERE EXCLUDED.best_score > leaderboard.best_score
                RETURNING {_ENTRY_COLUMNS}
                """,
                arena,
                score,
                holder_name,
                user_id,
            )
        if row is None:
            existing = await self.get_best(arena)
            assert existing is not None, "upsert returned no row and get_best too"
            return existing
        return _row_to_entry(row)

    async def list_top(self, arena: str, limit: int = 10) -> list[LeaderboardEntry]:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT {_ENTRY_COLUMNS} FROM leaderboard WHERE arena = $1 "
                "ORDER BY best_score DESC LIMIT $2",
                arena,
                limit,
            )
        return [_row_to_entry(r) for r in rows]


def _row_to_entry(row: asyncpg.Record) -> LeaderboardEntry:
    return LeaderboardEntry(
        arena=row["arena"],
        best_score=row["best_score"],
        holder_name=row["holder_name"],
        updated_at=row["updated_at"].isoformat(),
        user_id=str(row["user_id"]) if row["user_id"] is not None else None,
    )
