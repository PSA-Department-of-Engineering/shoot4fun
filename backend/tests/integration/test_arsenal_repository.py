"""Postgres round-trip for the Arsenal get/put envelope (INT-029).

The in-memory contract tests (test_arsenal_shape.py) prove the envelope is
forward-compatible, but they never exercise the real Postgres decode path:
`get_arsenal` reads a `jsonb` column, and the build fixed a decode bug there
that the in-memory test could not catch. This test PUTs then GETs an Arsenal
envelope through Postgres and asserts the round-trip, so the decode path is
covered. It runs only when `TEST_DATABASE_URL` is set; the CI suite attests
the in-memory contracts either way.
"""
from __future__ import annotations

import os
import uuid
from typing import TYPE_CHECKING

import pytest
import pytest_intent

if TYPE_CHECKING:
    from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (
        PostgresAccountRepository,
    )

PG_DSN = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
async def pg_repo() -> PostgresAccountRepository:
    if not PG_DSN:
        pytest.skip("TEST_DATABASE_URL not set; postgres arsenal test skipped")
    # The driver is an optional extra, imported where it is used so a
    # machine without it still attests the in-memory contracts below
    # instead of failing collection for the whole module.
    asyncpg = pytest.importorskip("asyncpg", reason="asyncpg not installed")
    from shoot4fun_backend.adapters.outbound.postgres.postgres_account_repository import (
        PostgresAccountRepository,
    )

    dsn = PG_DSN
    repo = PostgresAccountRepository(dsn)
    await repo.connect()
    try:
        yield repo
    finally:
        admin = await asyncpg.connect(dsn)
        try:
            # The account the test created (create_guest) is not cascade-cleaned
            # by the arsenal_profiles delete, so drop both to leave no residue.
            await admin.execute(
                "DELETE FROM arsenal_profiles WHERE user_id LIKE 'arsenal_test_%'"
            )
            await admin.execute(
                "DELETE FROM accounts WHERE user_id LIKE 'arsenal_test_%'"
            )
        finally:
            await admin.close()
        await repo.close()


@pytest_intent.intent("INT-029")
@pytest.mark.skipif(not PG_DSN, reason="postgres not configured")
async def test_arsenal_envelope_round_trips_through_postgres(
    pg_repo: PostgresAccountRepository,
) -> None:
    # An over-shaped payload: fields the current build does not name
    # (weapon_unlocks, outfits, stats) alongside the known ones. The
    # round-trip must survive the real jsonb decode path verbatim.
    user_id = f"arsenal_test_{uuid.uuid4().hex[:8]}"
    await pg_repo.create_guest(user_id, f"arsenal_{uuid.uuid4().hex[:8]}")

    envelope = {
        "version": 1,
        "data": {
            "model": "robot",
            "inventory": [{"primary": "rifle", "secondary": "smg"}],
            "weapon_unlocks": ["shotgun", "sniper"],
            "outfits": {"default": "crimson"},
            "stats": {"kills": 12, "matches": 3},
        },
    }
    await pg_repo.save_arsenal(user_id, envelope)
    loaded = await pg_repo.get_arsenal(user_id)

    assert loaded == envelope
    # The known fields are intact...
    assert loaded["version"] == 1
    assert loaded["data"]["model"] == "robot"
    # ...and the unknown future fields were not dropped on the jsonb decode.
    assert loaded["data"]["weapon_unlocks"] == ["shotgun", "sniper"]
    assert loaded["data"]["outfits"] == {"default": "crimson"}
    assert loaded["data"]["stats"] == {"kills": 12, "matches": 3}
