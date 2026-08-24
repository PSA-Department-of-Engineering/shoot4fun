"""The expiry column must reach databases that predate it (INT-019's table).

`expires_at` shipped inside `CREATE TABLE IF NOT EXISTS account_sessions`,
which is a no-op on a table minted by an earlier deploy - production
answered every guest mint with `UndefinedColumnError` for exactly this
reason. The repair is an `ADD COLUMN IF NOT EXISTS` beside the CREATE; this
test attests the repair, not the SQL: it rebuilds the pre-expiry table
shape, runs the real `connect()` against it, then drives the mint journey
the fault broke. A round-trip on a fresh database can never see this drift,
because there the CREATE always produces the current shape.

Skipped unless `TEST_DATABASE_URL` is set; CI carries a Postgres service so
the skip is the exception, not the rule. Cleanup removes only the rows this
module minted (the sentinel account and its cascade).
"""
from __future__ import annotations

import asyncio
import os

import pytest

PG_DSN = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not PG_DSN,
    reason="TEST_DATABASE_URL not set; postgres account upgrade skipped",
)

SESSION = "X-S4F-Session"
SENTINEL_USER = "usr_pg_upgrade_sentinel"
LEGACY_TOKEN = "pre-expiry-legacy-session"


def _reshape_to_pre_expiry() -> None:
    """Recreate `account_sessions` as it existed before expiry shipped, so
    the adapter's `connect()` meets a table its CREATE block cannot update."""
    asyncpg = pytest.importorskip("asyncpg")

    async def _run() -> None:
        from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (  # noqa: E501
            _SCHEMA,
        )

        conn = await asyncpg.connect(PG_DSN)
        try:
            # Base tables first, so this module also works on a virgin
            # database where no prior connect() has run.
            await conn.execute(_SCHEMA)
            await conn.execute("DROP TABLE IF EXISTS account_sessions")
            await conn.execute(
                "CREATE TABLE account_sessions ("
                "  token_hash TEXT PRIMARY KEY,"
                "  user_id    TEXT NOT NULL"
                "             REFERENCES accounts (user_id) ON DELETE CASCADE,"
                "  created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
                ")"
            )
            await conn.execute(
                "INSERT INTO accounts (user_id, display_name) VALUES ($1, $2)"
                " ON CONFLICT DO NOTHING",
                SENTINEL_USER,
                "pg-upgrade-sentinel",
            )
            await conn.execute(
                "INSERT INTO account_sessions (token_hash, user_id) VALUES ($1, $2)",
                LEGACY_TOKEN,
                SENTINEL_USER,
            )
        finally:
            await conn.close()

    asyncio.run(_run())


@pytest.fixture()
def upgraded_db(monkeypatch):
    """The pre-expiry shape, then the app wired to it, lifespan included."""
    _reshape_to_pre_expiry()
    minted: list[str] = []
    monkeypatch.setenv("DATABASE_URL", PG_DSN)
    from fastapi.testclient import TestClient

    from shoot4fun_backend.adapters.inbound.http.app import create_app

    with TestClient(create_app()) as client:
        yield client, minted

    asyncpg = pytest.importorskip("asyncpg")

    async def _purge() -> None:
        conn = await asyncpg.connect(PG_DSN)
        try:
            for user_id in [*minted, SENTINEL_USER]:
                await conn.execute(
                    "DELETE FROM accounts WHERE user_id = $1", user_id
                )
        finally:
            await conn.close()

    asyncio.run(_purge())


def test_expiry_column_migrates_tables_that_predate_it(upgraded_db) -> None:
    client, minted = upgraded_db
    asyncpg = pytest.importorskip("asyncpg")

    async def _column_shape():
        conn = await asyncpg.connect(PG_DSN)
        try:
            return await conn.fetchrow(
                "SELECT data_type, is_nullable, column_default"
                "  FROM information_schema.columns"
                " WHERE table_name = 'account_sessions'"
                "   AND column_name = 'expires_at'"
            )
        finally:
            await conn.close()

    shape = asyncio.run(_column_shape())
    assert shape is not None, "connect() did not add expires_at"
    assert shape["data_type"] == "timestamp with time zone"
    assert shape["is_nullable"] == "NO"
    assert shape["column_default"] is not None
    assert shape["column_default"].startswith("now()")

    # The carried row was backfilled as already expired: resolution honours
    # the new column even for sessions minted before expiry existed.
    expired = client.get("/api/account/me", headers={SESSION: LEGACY_TOKEN})
    assert expired.status_code == 401

    # And the journey the prod fault broke works against the migrated table.
    mint = client.post("/api/account/guest")
    assert mint.status_code == 201, mint.text
    body = mint.json()
    minted.append(body["user_id"])

    me = client.get("/api/account/me", headers={SESSION: body["token"]})
    assert me.status_code == 200
    assert me.json()["user_id"] == body["user_id"]
