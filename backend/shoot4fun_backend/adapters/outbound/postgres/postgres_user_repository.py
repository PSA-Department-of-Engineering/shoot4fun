"""Postgres `UserRepository`.

Backs the profile store (issue #12) with the platform's per-app database
role (`pg-app-shoot4fun`), the same database the leaderboard (`INT-017`)
lives in. The schema is a single `users` table carrying the profile
shape: unique username, display name, and the three preferences.

The DSN comes from `DATABASE_URL`; the platform mounts it via the
secret-plus-reflector mirror scoped to the `shoot4fun` namespace. A
missing DSN is a startup error (the contract is the platform-minted
credential, not a fallback to the in-memory store). The leaderboard
repository references `users(id)` on its own column, so this repository
must connect before it when the container starts.
"""
from __future__ import annotations

import asyncpg

from shoot4fun_backend.application.ports.outbound.user_repository import UserRepository
from shoot4fun_backend.domain.exceptions.username_taken_error import UsernameTakenError
from shoot4fun_backend.domain.model.user_profile import UserProfile
from shoot4fun_backend.logging import get_logger

__all__ = ["PostgresUserRepository"]


_log = get_logger("postgres_users")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    sensitivity DOUBLE PRECISION NOT NULL,
    master_volume DOUBLE PRECISION NOT NULL,
    sfx_volume DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""

_PROFILE_COLUMNS = "id, username, display_name, sensitivity, master_volume, sfx_volume, created_at"


class PostgresUserRepository(UserRepository):
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=4)
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA)
        _log.info("postgres_users connected")

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def create(
        self,
        username: str,
        display_name: str,
        sensitivity: float,
        master_volume: float,
        sfx_volume: float,
    ) -> UserProfile:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                INSERT INTO users (username, display_name, sensitivity, master_volume, sfx_volume)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (username) DO NOTHING
                RETURNING {_PROFILE_COLUMNS}
                """,
                username,
                display_name,
                sensitivity,
                master_volume,
                sfx_volume,
            )
        if row is None:
            raise UsernameTakenError(username)
        return _row_to_profile(row)

    async def get_by_username(self, username: str) -> UserProfile | None:
        assert self._pool is not None, "call connect() first"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_PROFILE_COLUMNS} FROM users WHERE username = $1",
                username,
            )
        return _row_to_profile(row) if row is not None else None

    async def update_profile(
        self,
        username: str,
        *,
        display_name: str | None = None,
        sensitivity: float | None = None,
        master_volume: float | None = None,
        sfx_volume: float | None = None,
    ) -> UserProfile | None:
        assert self._pool is not None, "call connect() first"
        sets = []
        values: list = []
        if display_name is not None:
            sets.append(f"display_name = ${len(values) + 1}")
            values.append(display_name)
        if sensitivity is not None:
            sets.append(f"sensitivity = ${len(values) + 1}")
            values.append(sensitivity)
        if master_volume is not None:
            sets.append(f"master_volume = ${len(values) + 1}")
            values.append(master_volume)
        if sfx_volume is not None:
            sets.append(f"sfx_volume = ${len(values) + 1}")
            values.append(sfx_volume)
        if not sets:
            return await self.get_by_username(username)
        values.append(username)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE users SET {", ".join(sets)}
                WHERE username = ${len(values)}
                RETURNING {_PROFILE_COLUMNS}
                """,
                *values,
            )
        return _row_to_profile(row) if row is not None else None


def _row_to_profile(row: asyncpg.Record) -> UserProfile:
    return UserProfile(
        id=str(row["id"]),
        username=row["username"],
        display_name=row["display_name"],
        sensitivity=row["sensitivity"],
        master_volume=row["master_volume"],
        sfx_volume=row["sfx_volume"],
        created_at=row["created_at"].isoformat(),
    )
