"""The expiry column must reach databases that predate it (INT-019's table).

`expires_at` shipped inside `CREATE TABLE IF NOT EXISTS account_sessions`,
which is a no-op on a table minted by an earlier deploy - production
answered every guest mint with `UndefinedColumnError` for exactly this
reason. The repair is an `ADD COLUMN IF NOT EXISTS` beside the CREATE; this
test attests the repair, not the SQL: it rebuilds the pre-expiry table
shape, runs the real `connect()` against it, then drives the mint journey
the fault broke. A round-trip on a fresh database can never see this drift,
because there the CREATE always produces the current shape.

The reshape briefly replaces `account_sessions` with its pre-expiry shape
and restores it afterwards, so whatever rows the database carried when the
test started are put back (the #51/#63 shared-database hygiene precedent).
Skipped unless `TEST_DATABASE_URL` is set; CI carries a Postgres service so
the skip is the exception, not the rule. Cleanup removes only the accounts
this module minted.
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


def _connect():
    asyncpg = pytest.importorskip("asyncpg")
    return asyncpg.connect(PG_DSN)


def _purge_accounts(user_ids: list[str]) -> None:
    """Delete accounts by id; sessions and envelopes cascade."""

    async def _run() -> None:
        conn = await _connect()
        try:
            for user_id in user_ids:
                await conn.execute(
                    "DELETE FROM accounts WHERE user_id = $1", user_id
                )
        finally:
            await conn.close()

    asyncio.run(_run())


def _reshape_to_pre_expiry() -> list[dict]:
    """Recreate `account_sessions` as it existed before expiry shipped, so
    the adapter's `connect()` meets a table its CREATE block cannot update.

    Returns the rows the table carried, for restoration in the fixture's
    finally block."""
    async def _run() -> list[dict]:
        from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (  # noqa: E501
            _SCHEMA,
        )

        conn = await _connect()
        try:
            # Base tables first, so this module also works on a virgin
            # database where no prior connect() has run.
            await conn.execute(_SCHEMA)
            carried = [
                dict(r)
                for r in await conn.fetch("SELECT * FROM account_sessions")
            ]
            await conn.execute("DROP TABLE account_sessions")
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
            return carried
        finally:
            await conn.close()

    return asyncio.run(_run())


def _restore_sessions(carried: list[dict]) -> None:
    """Put the pre-test shape and rows back. Best effort by design: a test
    database left one table newer than it started is survivable residue;
    a crash inside the reshape is not this function's problem."""

    async def _run() -> None:
        from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (  # noqa: E501
            _SCHEMA,
        )

        conn = await _connect()
        try:
            await conn.execute("DROP TABLE IF EXISTS account_sessions")
            await conn.execute(_SCHEMA)
            for row in carried:
                if "expires_at" in row:
                    await conn.execute(
                        "INSERT INTO account_sessions"
                        " (token_hash, user_id, created_at, expires_at)"
                        " VALUES ($1, $2, $3, $4)"
                        " ON CONFLICT DO NOTHING",
                        row["token_hash"],
                        row["user_id"],
                        row["created_at"],
                        row["expires_at"],
                    )
                else:
                    await conn.execute(
                        "INSERT INTO account_sessions"
                        " (token_hash, user_id, created_at) VALUES ($1, $2, $3)"
                        " ON CONFLICT DO NOTHING",
                        row["token_hash"],
                        row["user_id"],
                        row["created_at"],
                    )
        finally:
            await conn.close()

    asyncio.run(_run())


@pytest.fixture()
def upgraded_db(monkeypatch):
    """The pre-expiry shape under the app, then everything put back."""
    _purge_accounts([SENTINEL_USER])
    minted: list[str] = []
    carried: list[dict] = []
    monkeypatch.setenv("DATABASE_URL", PG_DSN)
    try:
        carried = _reshape_to_pre_expiry()
        from fastapi.testclient import TestClient

        from shoot4fun_backend.adapters.inbound.http.app import create_app

        with TestClient(create_app()) as client:
            yield client, minted
    finally:
        _restore_sessions(carried)
        _purge_accounts([*minted, SENTINEL_USER])


def test_expiry_column_migrates_tables_that_predate_it(upgraded_db) -> None:
    client, minted = upgraded_db

    async def _column_shape():
        conn = await _connect()
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
    # No permanent default: a migrated table must match a freshly minted
    # one, where the CREATE declares the column bare.
    assert shape["column_default"] is None

    # The carried row was backfilled as already expired - read directly,
    # before the container's startup sweep can reclaim it, so the leg
    # attests the backfill itself and not merely the row's absence.
    async def _legacy_row():
        conn = await _connect()
        try:
            return await conn.fetchrow(
                "SELECT expires_at <= now() AS expired"
                "  FROM account_sessions WHERE token_hash = $1",
                LEGACY_TOKEN,
            )
        finally:
            await conn.close()

    legacy = asyncio.run(_legacy_row())
    if legacy is not None:
        assert legacy["expired"] is True

    # Either way resolution honours expiry for the pre-expiry session...
    expired = client.get("/api/account/me", headers={SESSION: LEGACY_TOKEN})
    assert expired.status_code == 401

    # ...and the journey the prod fault broke works against the migrated
    # table. The id is collected before the asserts so a failing mint is
    # still purged.
    mint = client.post("/api/account/guest")
    body = mint.json() if mint.status_code == 201 else {}
    if body.get("user_id"):
        minted.append(body["user_id"])
    assert mint.status_code == 201, mint.text

    me = client.get("/api/account/me", headers={SESSION: body["token"]})
    assert me.status_code == 200
    assert me.json()["user_id"] == body["user_id"]
