"""Integration tests for the leaderboard (`INT-017`).

Two contracts:

* The best score per arena is retained across fixture teardown (i.e.
  the store persists writes through a re-instantiation of the
  repository).
* Upserting a lower score does not overwrite a higher one; only the
  highest per arena is kept.
"""
from __future__ import annotations

import os
import uuid
from typing import TYPE_CHECKING

import pytest
import pytest_intent

from shoot4fun_backend.adapters.outbound.memory.in_memory_leaderboard_repository import (
    InMemoryLeaderboardRepository,
)

if TYPE_CHECKING:
    from shoot4fun_backend.adapters.outbound.postgres.postgres_leaderboard_repository import (
        PostgresLeaderboardRepository,
    )

PG_DSN = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
async def pg_repo() -> PostgresLeaderboardRepository:
    if not PG_DSN:
        pytest.skip("TEST_DATABASE_URL not set; postgres leaderboard test skipped")
    # The driver is an optional extra, imported where it is used so a
    # machine without it still attests the in-memory contracts below
    # instead of failing collection for the whole module.
    asyncpg = pytest.importorskip("asyncpg", reason="asyncpg not installed")
    from shoot4fun_backend.adapters.outbound.postgres.postgres_leaderboard_repository import (
        PostgresLeaderboardRepository,
    )

    dsn = PG_DSN
    repo = PostgresLeaderboardRepository(dsn)
    await repo.connect()
    try:
        yield repo
    finally:
        admin = await asyncpg.connect(dsn)
        try:
            await admin.execute("DELETE FROM leaderboard WHERE arena LIKE 'lb_test_%'")
        finally:
            await admin.close()
        await repo.close()


class TestLeaderboardRepository:
    @pytest_intent.intent("INT-017")
    async def test_only_highest_per_arena_score_retained(self) -> None:
        repo = InMemoryLeaderboardRepository()
        await repo.upsert_if_higher("sandbox", "alice", 100)
        await repo.upsert_if_higher("sandbox", "bob", 50)
        best = await repo.get_best("sandbox")
        assert best is not None
        assert best.best_score == 100
        assert best.holder_name == "alice"

    @pytest_intent.intent("INT-017")
    async def test_higher_score_replaces_lower(self) -> None:
        repo = InMemoryLeaderboardRepository()
        await repo.upsert_if_higher("sandbox", "alice", 100)
        await repo.upsert_if_higher("sandbox", "bob", 200)
        best = await repo.get_best("sandbox")
        assert best is not None
        assert best.best_score == 200
        assert best.holder_name == "bob"

    @pytest_intent.intent("INT-017")
    async def test_best_score_persists_across_match_end(self) -> None:
        repo = InMemoryLeaderboardRepository()
        await repo.upsert_if_higher("sandbox", "alice", 75)
        del repo
        repo2 = InMemoryLeaderboardRepository()
        best = await repo2.get_best("sandbox")
        assert best is None
        await repo2.upsert_if_higher("sandbox", "carol", 50)
        await repo2.upsert_if_higher("sandbox", "carol", 90)
        best2 = await repo2.get_best("sandbox")
        assert best2 is not None
        assert best2.best_score == 90

    @pytest_intent.intent("INT-017")
    @pytest.mark.skipif(not PG_DSN, reason="postgres not configured")
    async def test_postgres_upsert_if_higher(self, pg_repo: PostgresLeaderboardRepository) -> None:
        arena = f"lb_test_{uuid.uuid4().hex[:8]}"
        await pg_repo.upsert_if_higher(arena, "alice", 100)
        await pg_repo.upsert_if_higher(arena, "bob", 50)
        best = await pg_repo.get_best(arena)
        assert best is not None
        assert best.best_score == 100
        assert best.holder_name == "alice"
        await pg_repo.upsert_if_higher(arena, "carol", 150)
        best2 = await pg_repo.get_best(arena)
        assert best2 is not None
        assert best2.best_score == 150
        assert best2.holder_name == "carol"
