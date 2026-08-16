"""Guest creation is bounded, concurrency-safe, and reclaimable.

`INT-022`. Minting a guest is the one write a caller can make with no
credential, so its cost must not grow with the table, contending callers must
all get an answer, and what it leaves behind has to be reclaimable.

These run over the service and its in-memory repository rather than the HTTP
surface, because the claims are about the account store's semantics under
concurrency and over time, which a request cannot express.
"""
from __future__ import annotations

import asyncio
import re

import pytest
import pytest_intent

from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
    InMemoryAccountRepository,
)
from shoot4fun_backend.application.services.account_service import (
    AccountService,
    guest_name,
)


@pytest_intent.intent("INT-022")
def test_the_generated_name_widens_under_pressure() -> None:
    # Readable while the space is empty, because this name is public wherever
    # the account appears; wide enough afterwards that it cannot be walked.
    for attempt in range(4):
        assert re.fullmatch(r"[A-Za-z]+[1-9]\d{3}", guest_name(attempt))
    for attempt in range(4, 8):
        assert re.fullmatch(r"[A-Za-z]+[1-9]\d{8}", guest_name(attempt))


@pytest_intent.intent("INT-022")
def test_a_taken_name_costs_one_insert_per_attempt() -> None:
    repo = InMemoryAccountRepository()
    service = AccountService(repo, session_ttl_ms=3_600_000)
    inner = repo.create_guest
    attempts = 0

    async def refusing(user_id: str, display_name: str):
        nonlocal attempts
        attempts += 1
        if attempts <= 3:
            return None
        return await inner(user_id, display_name)

    repo.create_guest = refusing  # type: ignore[method-assign]

    async def run() -> None:
        session = await service.start_guest()
        # One insert per attempt and no lookups: the previous shape asked the
        # store whether each candidate was free before trying it.
        assert attempts == 4
        assert await service.resolve_session(session.token) == session.account.user_id

    asyncio.run(run())


@pytest_intent.intent("INT-022")
def test_an_expired_guest_is_swept_and_a_registered_account_is_not() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo, session_ttl_ms=1)

        guest = await service.start_guest()
        named = await service.start_guest()
        minted = await service.register(named.account.user_id, "KeptByName")
        await asyncio.sleep(0.05)

        assert await service.sweep(0) == 1

        # The guest is gone; the registered account survives with no session at
        # all, because its recovery code still reaches it.
        assert await service.get(guest.account.user_id) is None
        assert await service.get(named.account.user_id) is not None
        back = await service.sign_in("KeptByName", minted.recovery_code)
        assert back.account.user_id == named.account.user_id

    asyncio.run(run())


@pytest_intent.intent("INT-022")
def test_a_live_session_protects_its_guest() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo, session_ttl_ms=3_600_000)
        live = await service.start_guest()

        assert await service.sweep(0) == 0
        assert await service.resolve_session(live.token) == live.account.user_id

    asyncio.run(run())


@pytest_intent.intent("INT-022")
def test_the_grace_window_spares_a_freshly_minted_guest() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo, session_ttl_ms=1)
        await service.start_guest()
        await asyncio.sleep(0.05)

        # An account and its first session are two statements; a sweep landing
        # between them must not take the account out from under the caller.
        assert await service.sweep(3_600_000) == 0
        # The same row, with no grace, proves the window is what saved it.
        assert await service.sweep(0) == 1

    asyncio.run(run())


@pytest.mark.anyio
@pytest_intent.intent("INT-022")
async def test_concurrent_guests_each_get_their_own_account() -> None:
    repo = InMemoryAccountRepository()
    service = AccountService(repo, session_ttl_ms=3_600_000)

    sessions = await asyncio.gather(*(service.start_guest() for _ in range(40)))
    assert len({s.account.user_id for s in sessions}) == 40
    assert len({s.account.display_name for s in sessions}) == 40
