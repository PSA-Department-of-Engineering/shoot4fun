"""Postgres `AccountRepository`, on the platform-minted `pg-app-shoot4fun` role.

Three tables. `accounts` holds the identity, `account_sessions` the live
sessions, `account_profiles` the preferences that follow a signed-in player.
Both credential columns hold digests only (`REF-Identity.md` section 4); this
adapter never sees a usable secret.

Two constraints carry the federation decisions rather than leaving them to
callers: `display_name` is unique case-insensitively, and
`(external_issuer, external_subject)` is unique together, so a second issuer
cannot claim an account already linked elsewhere.
"""
from __future__ import annotations

import json

import asyncpg

from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.arsenal import PlayerArsenal
from shoot4fun_backend.domain.model.player_profile import PlayerProfile
from shoot4fun_backend.logging import get_logger

__all__ = ["PostgresAccountRepository"]

_log = get_logger("postgres_accounts")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    user_id           TEXT PRIMARY KEY,
    display_name      TEXT NOT NULL,
    recovery_hash     TEXT,
    registered        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    external_issuer   TEXT,
    external_subject  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_display_name_lower_idx
    ON accounts (lower(display_name));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_external_identity_idx
    ON accounts (external_issuer, external_subject)
    WHERE external_issuer IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES accounts (user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_user_idx ON account_sessions (user_id);

CREATE TABLE IF NOT EXISTS account_profiles (
    user_id            TEXT PRIMARY KEY REFERENCES accounts (user_id) ON DELETE CASCADE,
    sensitivity        DOUBLE PRECISION NOT NULL,
    touch_sensitivity  DOUBLE PRECISION NOT NULL,
    master_volume      DOUBLE PRECISION NOT NULL,
    sfx_volume         DOUBLE PRECISION NOT NULL,
    haptics_enabled    BOOLEAN NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arsenal_profiles (
    user_id   TEXT PRIMARY KEY REFERENCES accounts (user_id) ON DELETE CASCADE,
    payload   JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

_ACCOUNT_COLUMNS = (
    "user_id, display_name, registered, created_at, external_issuer, external_subject"
)


def _to_account(row: asyncpg.Record) -> Account:
    return Account(
        user_id=row["user_id"],
        display_name=row["display_name"],
        registered=row["registered"],
        created_at=row["created_at"].isoformat(),
        external_issuer=row["external_issuer"],
        external_subject=row["external_subject"],
    )


class PostgresAccountRepository(AccountRepository):
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=4)
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA)
        _log.info("postgres_accounts connected")

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @property
    def _ready(self) -> asyncpg.Pool:
        assert self._pool is not None, "call connect() first"
        return self._pool

    async def create_guest(
        self, user_id: str, display_name: str
    ) -> Account | None:
        """The insert IS the uniqueness check. ``ON CONFLICT DO NOTHING`` with
        no target covers the primary key and the case-insensitive display-name
        index alike, so a name another connection took a microsecond earlier
        comes back as no row rather than as a raised constraint violation."""
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"INSERT INTO accounts (user_id, display_name) VALUES ($1, $2) "
                f"ON CONFLICT DO NOTHING RETURNING {_ACCOUNT_COLUMNS}",
                user_id,
                display_name,
            )
        return _to_account(row) if row is not None else None

    async def get(self, user_id: str) -> Account | None:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE user_id = $1", user_id
            )
        return _to_account(row) if row else None

    async def find_by_display_name(self, display_name: str) -> Account | None:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_ACCOUNT_COLUMNS} FROM accounts "
                f"WHERE lower(display_name) = lower($1)",
                display_name,
            )
        return _to_account(row) if row else None

    async def find_by_external(self, issuer: str, subject: str) -> Account | None:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_ACCOUNT_COLUMNS} FROM accounts "
                f"WHERE external_issuer = $1 AND external_subject = $2",
                issuer,
                subject,
            )
        return _to_account(row) if row else None

    async def register(
        self, user_id: str, display_name: str, recovery_hash: str
    ) -> Account:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE accounts SET display_name = $2, recovery_hash = $3, "
                f"registered = TRUE WHERE user_id = $1 RETURNING {_ACCOUNT_COLUMNS}",
                user_id,
                display_name,
                recovery_hash,
            )
        return _to_account(row)

    async def rename(self, user_id: str, display_name: str) -> Account:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE accounts SET display_name = $2 WHERE user_id = $1 "
                f"RETURNING {_ACCOUNT_COLUMNS}",
                user_id,
                display_name,
            )
        return _to_account(row)

    async def recovery_hash_for(self, user_id: str) -> str | None:
        async with self._ready.acquire() as conn:
            return await conn.fetchval(
                "SELECT recovery_hash FROM accounts WHERE user_id = $1", user_id
            )

    async def set_recovery_hash(self, user_id: str, recovery_hash: str) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute(
                "UPDATE accounts SET recovery_hash = $2 WHERE user_id = $1",
                user_id,
                recovery_hash,
            )

    async def create_session(
        self, token_hash: str, user_id: str, ttl_ms: int
    ) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute(
                "INSERT INTO account_sessions (token_hash, user_id, expires_at) "
                "VALUES ($1, $2, now() + make_interval(secs => $3)) "
                "ON CONFLICT (token_hash) DO NOTHING",
                token_hash,
                user_id,
                ttl_ms // 1000,
            )

    async def user_id_for_session(self, token_hash: str) -> str | None:
        async with self._ready.acquire() as conn:
            return await conn.fetchval(
                "SELECT user_id FROM account_sessions "
                "WHERE token_hash = $1 AND expires_at > now()",
                token_hash,
            )

    async def delete_session(self, token_hash: str) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute(
                "DELETE FROM account_sessions WHERE token_hash = $1", token_hash
            )

    async def delete_sessions_for_user(self, user_id: str) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute("DELETE FROM account_sessions WHERE user_id = $1", user_id)

    async def sweep(self, grace_ms: int) -> int:
        """Expired sessions first, so the guests they were holding up fall in
        the same pass. ``registered`` is the guard that matters: a named
        account owns a recovery code and is reachable with no session at all."""
        async with self._ready.acquire() as conn:
            await conn.execute("DELETE FROM account_sessions WHERE expires_at < now()")
            status = await conn.execute(
                "DELETE FROM accounts "
                "WHERE registered = FALSE "
                "  AND created_at < now() - make_interval(secs => $1) "
                "  AND NOT EXISTS ("
                "      SELECT 1 FROM account_sessions s WHERE s.user_id = accounts.user_id"
                "  )",
                grace_ms // 1000,
            )
        return int(status.split()[-1]) if status else 0

    async def get_profile(self, user_id: str) -> PlayerProfile | None:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT sensitivity, touch_sensitivity, master_volume, sfx_volume, "
                "haptics_enabled FROM account_profiles WHERE user_id = $1",
                user_id,
            )
        if row is None:
            return None
        return PlayerProfile(
            sensitivity=row["sensitivity"],
            touch_sensitivity=row["touch_sensitivity"],
            master_volume=row["master_volume"],
            sfx_volume=row["sfx_volume"],
            haptics_enabled=row["haptics_enabled"],
        )

    async def save_profile(self, user_id: str, profile: PlayerProfile) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO account_profiles (
                    user_id, sensitivity, touch_sensitivity,
                    master_volume, sfx_volume, haptics_enabled, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    sensitivity = EXCLUDED.sensitivity,
                    touch_sensitivity = EXCLUDED.touch_sensitivity,
                    master_volume = EXCLUDED.master_volume,
                    sfx_volume = EXCLUDED.sfx_volume,
                    haptics_enabled = EXCLUDED.haptics_enabled,
                    updated_at = now()
                """,
                user_id,
                profile.sensitivity,
                profile.touch_sensitivity,
                profile.master_volume,
                profile.sfx_volume,
                profile.haptics_enabled,
            )

    async def get_arsenal(self, user_id: str) -> dict | None:
        async with self._ready.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT payload FROM arsenal_profiles WHERE user_id = $1", user_id
            )
        # asyncpg decodes a jsonb column to a dict by default; if a custom
        # codec left it as text, decode it before the envelope parse.
        if row is None:
            return None
        payload = row["payload"]
        return json.loads(payload) if isinstance(payload, str) else payload

    async def save_arsenal(self, user_id: str, envelope: dict) -> None:
        async with self._ready.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO arsenal_profiles (user_id, payload, updated_at)
                VALUES ($1, $2::jsonb, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_at = now()
                """,
                user_id,
                json.dumps(envelope),
            )
