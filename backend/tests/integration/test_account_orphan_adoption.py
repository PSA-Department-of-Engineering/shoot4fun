"""A named account that holds no credential can be claimed in place.

The password-auth migration (#54) dropped `recovery_hash` while adding an
empty `password_hash`, so every account registered before it came out of the
upgrade `registered = TRUE` with a NULL digest: sign-in refuses it, the name
cannot be re-registered, and no session can be minted for it. Unreachable by
construction, it is the one named account a live guest may claim - the claim
upgrades the orphaned row in place, so the name and the scores it carries
survive instead of being orphaned for ever.

These run over the service and its in-memory repository rather than the HTTP
surface, because the state under test is a row shape only the migration could
produce; the Postgres leg of that shape is attested against real SQL in
`test_account_pg_roundtrip.py`.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
    InMemoryAccountRepository,
)
from shoot4fun_backend.application.services.account_service import AccountService
from shoot4fun_backend.domain.exceptions.authentication_failed_error import (
    AuthenticationFailedError,
)
from shoot4fun_backend.domain.exceptions.display_name_taken_error import (
    DisplayNameTakenError,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.player_profile import PlayerProfile

LEGACY_ID = "usr_pre_password_migration"


def _seed_orphan(repo: InMemoryAccountRepository, display_name: str) -> None:
    """The row shape the #54 migration left behind: named and registered, with
    no digest on file because the column that held it was dropped."""
    repo._accounts[LEGACY_ID] = Account(
        user_id=LEGACY_ID,
        display_name=display_name,
        registered=True,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def _service() -> tuple[AccountService, InMemoryAccountRepository]:
    repo = InMemoryAccountRepository()
    return AccountService(repo, session_ttl_ms=3_600_000), repo


def test_a_credentialess_name_is_claimed_in_place() -> None:
    async def run() -> None:
        service, repo = _service()
        _seed_orphan(repo, "Carter")
        # The scores the orphan carries are exactly what the claim is for.
        await repo.save_profile(
            LEGACY_ID,
            PlayerProfile(
                sensitivity=0.004,
                touch_sensitivity=0.003,
                master_volume=0.6,
                sfx_volume=0.9,
                haptics_enabled=False,
            ),
        )

        claimant = await service.start_guest()
        adopted = await service.create_account(
            claimant.account.user_id, "Carter", "newpassword1"
        )

        # The SAME row, upgraded in place: the id - and everything keyed on
        # it - survives the claim.
        assert adopted.user_id == LEGACY_ID
        assert adopted.registered is True
        assert adopted.display_name == "Carter"
        kept = await service.get_profile(LEGACY_ID)
        assert kept.sensitivity == 0.004

        # The claimant's session now resolves to the account it claimed; the
        # guest row it came from holds no session and falls to the sweep.
        assert await service.resolve_session(claimant.token) == LEGACY_ID
        await asyncio.sleep(0.05)
        assert await service.sweep(0) == 1
        assert await service.get(claimant.account.user_id) is None
        assert await service.get(LEGACY_ID) is not None

        # The chosen password opens the account from a device holding no
        # session - the journey the upgrade broke.
        signed = await service.sign_in("carter", "newpassword1")
        assert signed.account.user_id == LEGACY_ID

    asyncio.run(run())


def test_a_name_held_by_a_password_account_is_still_refused() -> None:
    async def run() -> None:
        service, _ = _service()
        owner = await service.start_guest()
        await service.create_account(owner.account.user_id, "Held", "ownerpass1")

        claimant = await service.start_guest()
        with pytest.raises(DisplayNameTakenError):
            await service.create_account(claimant.account.user_id, "held", "claimpass1")

    asyncio.run(run())


def test_a_registered_caller_cannot_claim_an_orphan() -> None:
    async def run() -> None:
        service, repo = _service()
        _seed_orphan(repo, "Unclaimed")
        named = await service.start_guest()
        await service.create_account(
            named.account.user_id, "AlreadyNamed", "namedpass1"
        )

        with pytest.raises(DisplayNameTakenError):
            await service.create_account(
                named.account.user_id, "Unclaimed", "namedpass1"
            )

    asyncio.run(run())


def test_of_two_racers_for_one_orphan_exactly_one_wins() -> None:
    async def run() -> None:
        service, repo = _service()
        _seed_orphan(repo, "One Name")
        first = await service.start_guest()
        second = await service.start_guest()

        await service.create_account(first.account.user_id, "One Name", "first12345")
        with pytest.raises(DisplayNameTakenError):
            await service.create_account(
                second.account.user_id, "One Name", "second1234"
            )

        # The winner holds it, under the winner's credential only.
        signed = await service.sign_in("One Name", "first12345")
        assert signed.account.user_id == LEGACY_ID
        with pytest.raises(AuthenticationFailedError):
            await service.sign_in("One Name", "second1234")

    asyncio.run(run())
