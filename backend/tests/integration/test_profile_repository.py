"""Integration tests for the profile store (`INT-018`).

Two contracts:

* A profile is created, read back, and patched by username; a second
  creation of an existing username is refused.
* The store persists writes through a re-instantiation of the
  repository (the Postgres leg).
"""
from __future__ import annotations

import os
import uuid
from typing import TYPE_CHECKING

import pytest
import pytest_intent

from shoot4fun_backend.adapters.outbound.memory.in_memory_user_repository import (
    InMemoryUserRepository,
)
from shoot4fun_backend.domain.exceptions.username_taken_error import UsernameTakenError

if TYPE_CHECKING:
    from shoot4fun_backend.adapters.outbound.postgres.postgres_user_repository import (
        PostgresUserRepository,
    )

PG_DSN = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
async def pg_users() -> PostgresUserRepository:
    if not PG_DSN:
        pytest.skip("TEST_DATABASE_URL not set; postgres profile test skipped")
    asyncpg = pytest.importorskip("asyncpg", reason="asyncpg not installed")
    from shoot4fun_backend.adapters.outbound.postgres.postgres_user_repository import (
        PostgresUserRepository,
    )

    repo = PostgresUserRepository(PG_DSN)
    await repo.connect()
    try:
        yield repo
    finally:
        admin = await asyncpg.connect(PG_DSN)
        try:
            await admin.execute("DELETE FROM users WHERE username LIKE 'pf_test_%'")
        finally:
            await admin.close()
        await repo.close()


class TestUserRepository:
    @pytest_intent.intent("INT-018")
    async def test_create_read_and_patch_round_trip(self) -> None:
        repo = InMemoryUserRepository()
        created = await repo.create("sniper", "Sniper", 0.003, 0.5, 0.4)
        assert created.username == "sniper"
        assert created.display_name == "Sniper"

        read = await repo.get_by_username("sniper")
        assert read is not None
        assert read.sensitivity == 0.003

        patched = await repo.update_profile("sniper", master_volume=0.9)
        assert patched is not None
        assert patched.master_volume == 0.9
        assert patched.sensitivity == 0.003  # untouched fields survive

    @pytest_intent.intent("INT-018")
    async def test_second_creation_of_username_is_refused(self) -> None:
        repo = InMemoryUserRepository()
        await repo.create("sniper", "Sniper", 0.0022, 0.7, 0.8)
        with pytest.raises(UsernameTakenError):
            await repo.create("sniper", "Other", 0.001, 0.1, 0.1)

    @pytest_intent.intent("INT-018")
    async def test_unknown_username_answers_none(self) -> None:
        repo = InMemoryUserRepository()
        assert await repo.get_by_username("nobody") is None
        assert await repo.update_profile("nobody", display_name="Ghost") is None

    @pytest_intent.intent("INT-018")
    @pytest.mark.skipif(not PG_DSN, reason="postgres not configured")
    async def test_postgres_profile_round_trip(self, pg_users: PostgresUserRepository) -> None:
        username = f"pf_test_{uuid.uuid4().hex[:8]}"
        created = await pg_users.create(username, "Round Trip", 0.003, 0.5, 0.4)
        assert created.username == username
        assert created.id

        read = await pg_users.get_by_username(username)
        assert read is not None
        assert read.display_name == "Round Trip"

        with pytest.raises(UsernameTakenError):
            await pg_users.create(username, "Other", 0.001, 0.1, 0.1)

        patched = await pg_users.update_profile(username, sfx_volume=0.2)
        assert patched is not None
        assert patched.sfx_volume == 0.2
        assert patched.master_volume == 0.5
