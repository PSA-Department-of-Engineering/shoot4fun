"""The account lifecycle rides real Postgres (INT-019/INT-020).

The in-memory contract tests attest the semantics, but they never exercise
the Postgres adapter's write path: `create_guest`'s insert-as-uniqueness,
`create_session`'s TTL arithmetic, and the session-resolution lookup. A
fault there shipped green because no gate ran these against a real
database. This file does: it drives the HTTP surface end to end with the
app factory wired to `TEST_DATABASE_URL`, so the adapter's actual SQL runs.
Skipped unless `TEST_DATABASE_URL` is set; CI carries a Postgres service so
the skip is the exception, not the rule.

Rows are cleaned by user_id prefix, per the #51/#63 precedent: the tests
mint guests under a marker prefix and delete them after (sessions cascade)
so a shared database keeps no residue. The service mints its own `usr_`
ids, so the cleanup targets the accounts this module created and nothing
else.
"""
from __future__ import annotations

import os

import pytest
import pytest_intent

PG_DSN = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not PG_DSN,
    reason="TEST_DATABASE_URL not set; postgres account round-trip skipped",
)

SESSION = "X-S4F-Session"


@pytest.fixture()
def pg_client(monkeypatch):
    """The app wired to the real database, lifespan included."""
    monkeypatch.setenv("DATABASE_URL", PG_DSN)
    from fastapi.testclient import TestClient

    from shoot4fun_backend.adapters.inbound.http.app import create_app

    with TestClient(create_app()) as client:
        yield client


@pytest.fixture()
def minted_users():
    """Collect minted user ids, then drop them (sessions cascade)."""
    ids: list[str] = []
    yield ids
    if not ids:
        return
    asyncpg = pytest.importorskip("asyncpg")

    import asyncio

    async def _purge() -> None:
        conn = await asyncpg.connect(PG_DSN)
        try:
            for user_id in ids:
                await conn.execute(
                    "DELETE FROM accounts WHERE user_id = $1", user_id
                )
        finally:
            await conn.close()

    asyncio.run(_purge())


def _mint(client) -> dict:
    response = client.post("/api/account/guest")
    assert response.status_code == 201, response.text
    return response.json()


@pytest_intent.intent("INT-019")
def test_guest_mint_roundtrip_on_postgres(pg_client, minted_users) -> None:
    body = _mint(pg_client)
    token = body["token"]
    user_id = body["user_id"]
    minted_users.append(user_id)

    assert user_id.startswith("usr_")
    assert body["display_name"]
    assert body["registered"] is False

    # The minted session resolves through the one choke point: a real
    # digest row was written and is read back within TTL.
    me = pg_client.get("/api/account/me", headers={SESSION: token})
    assert me.status_code == 200
    assert me.json()["user_id"] == user_id


@pytest_intent.intent("INT-020")
def test_second_mint_is_an_independent_account(pg_client, minted_users) -> None:
    first = _mint(pg_client)
    second = _mint(pg_client)
    minted_users.extend([first["user_id"], second["user_id"]])

    assert first["user_id"] != second["user_id"]
    # Two live sessions resolve to their own accounts, not to each other.
    me_a = pg_client.get(
        "/api/account/me", headers={SESSION: first["token"]}
    ).json()
    me_b = pg_client.get(
        "/api/account/me", headers={SESSION: second["token"]}
    ).json()
    assert {me_a["user_id"], me_b["user_id"]} == {
        first["user_id"],
        second["user_id"],
    }


LEGACY_ORPHAN = "usr_pg_legacy_orphan"


@pytest_intent.intent("INT-019")
def test_a_credentialess_legacy_account_is_claimed(pg_client, minted_users) -> None:
    """The production fault the #54 migration left, against real SQL: every
    account registered before it came out `registered = TRUE` with a NULL
    `password_hash`, so sign-in refused it and the name could not be
    re-registered. The repair is the claim: a live guest creating the name
    upgrades the orphaned row in place, keeping its id and its data."""
    asyncpg = pytest.importorskip("asyncpg")

    import asyncio

    async def _seed() -> None:
        conn = await asyncpg.connect(PG_DSN)
        try:
            await conn.execute(
                "INSERT INTO accounts (user_id, display_name, registered) "
                "VALUES ($1, $2, TRUE) ON CONFLICT (user_id) DO NOTHING",
                LEGACY_ORPHAN,
                "Legacy Carter",
            )
            await conn.execute(
                "INSERT INTO account_profiles ("
                "  user_id, sensitivity, touch_sensitivity,"
                "  master_volume, sfx_volume, haptics_enabled"
                ") VALUES ($1, 0.004, 0.003, 0.6, 0.9, FALSE)"
                " ON CONFLICT (user_id) DO NOTHING",
                LEGACY_ORPHAN,
            )
        finally:
            await conn.close()

    asyncio.run(_seed())
    minted_users.append(LEGACY_ORPHAN)

    guest = _mint(pg_client)
    minted_users.append(guest["user_id"])

    created = pg_client.post(
        "/api/account/create",
        headers={SESSION: guest["token"]},
        json={"display_name": "Legacy Carter", "password": "reclaim123"},
    )
    assert created.status_code == 200, created.text
    # The SAME row: the orphaned id - and the profile keyed on it - survives.
    assert created.json()["user_id"] == LEGACY_ORPHAN

    me = pg_client.get("/api/account/me", headers={SESSION: guest["token"]})
    assert me.status_code == 200
    assert me.json()["user_id"] == LEGACY_ORPHAN

    profile = pg_client.get("/api/account/profile", headers={SESSION: guest["token"]})
    assert profile.status_code == 200
    assert profile.json()["sensitivity"] == 0.004

    # The chosen password opens the account from a device holding no session.
    signed = pg_client.post(
        "/api/account/sign-in",
        json={"display_name": "legacy carter", "password": "reclaim123"},
    )
    assert signed.status_code == 200, signed.text
    assert signed.json()["user_id"] == LEGACY_ORPHAN


SYSTEM_NAMES = ("carter", "katael")
SYSTEM_IDS = tuple(f"usr_system_{name}" for name in SYSTEM_NAMES)


@pytest.fixture()
def system_account_env(monkeypatch):
    """The one switch the boot pins system accounts on, wired to the real
    database, with the pinned rows cleaned up after."""
    asyncpg = pytest.importorskip("asyncpg")
    monkeypatch.setenv("DATABASE_URL", PG_DSN)
    monkeypatch.setenv("SYSTEM_ACCOUNT_PASSWORD", "adminpass1")
    yield
    import asyncio

    async def _purge() -> None:
        conn = await asyncpg.connect(PG_DSN)
        try:
            for user_id in SYSTEM_IDS:
                await conn.execute(
                    "DELETE FROM accounts WHERE user_id = $1", user_id
                )
        finally:
            await conn.close()

    asyncio.run(_purge())


@pytest_intent.intent("INT-019")
def test_the_boot_pins_system_accounts_on_postgres(system_account_env) -> None:
    """The deployment's system test accounts exist for the life of the
    database: the boot pins them, a second boot restates them, and the admin
    password opens them from the HTTP surface both times."""
    from fastapi.testclient import TestClient

    from shoot4fun_backend.adapters.inbound.http.app import create_app

    with TestClient(create_app()) as client:
        signed = client.post(
            "/api/account/sign-in",
            json={"display_name": "carter", "password": "adminpass1"},
        )
        assert signed.status_code == 200, signed.text
        assert signed.json()["user_id"] == "usr_system_carter"

    # A second boot is idempotent: restated, not duplicated.
    with TestClient(create_app()) as client:
        signed = client.post(
            "/api/account/sign-in",
            json={"display_name": "katael", "password": "adminpass1"},
        )
        assert signed.status_code == 200, signed.text
        assert signed.json()["user_id"] == "usr_system_katael"

    asyncpg = pytest.importorskip("asyncpg")
    import asyncio

    async def _count() -> int:
        conn = await asyncpg.connect(PG_DSN)
        try:
            return await conn.fetchval(
                "SELECT count(*) FROM accounts WHERE user_id = ANY($1)",
                list(SYSTEM_IDS),
            )
        finally:
            await conn.close()

    assert asyncio.run(_count()) == 2
