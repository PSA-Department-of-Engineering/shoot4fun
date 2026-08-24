"""System accounts: pinned at every boot, open to the admin password.

`carter` and `katael` are the deployment's known test logins. The pin is not
a seed - seeding runs once and rots (the #54 upgrade left these very accounts
registered with no digest, unopenable by anything). A pin runs at every boot
under a deterministic id and ends in one of exactly three states: the row is
created, an orphan holding the name is claimed in place, or the pin row's
digest is restated. The one refusal is a credentialed account holding the
name, because a boot must never override a credential that works.

These run over the service and its in-memory repository, with the container
wiring attested over the HTTP surface; the Postgres leg of the pin runs in
`test_account_pg_roundtrip.py`.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
    InMemoryAccountRepository,
)
from shoot4fun_backend.application.services.account_service import AccountService
from shoot4fun_backend.domain.exceptions.authentication_failed_error import (
    AuthenticationFailedError,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.player_profile import PlayerProfile

LEGACY_ID = "usr_pre_password_migration"


def _service() -> tuple[AccountService, InMemoryAccountRepository]:
    repo = InMemoryAccountRepository()
    return AccountService(repo, session_ttl_ms=3_600_000), repo


def _seed_orphan(repo: InMemoryAccountRepository, display_name: str) -> None:
    """The row shape the #54 migration left behind: named and registered, with
    no digest on file because the column that held it was dropped."""
    repo._accounts[LEGACY_ID] = Account(
        user_id=LEGACY_ID,
        display_name=display_name,
        registered=True,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def test_a_pinned_account_is_created_and_open_to_the_password() -> None:
    async def run() -> None:
        service, repo = _service()

        pinned = await service.ensure_system_account("carter", "adminpass1")

        assert pinned is not None
        assert pinned.registered is True
        assert pinned.user_id == "usr_system_carter"
        assert repo.get(pinned.user_id) is not None
        signed = await service.sign_in("carter", "adminpass1")
        assert signed.account.user_id == pinned.user_id

    asyncio.run(run())


def test_every_pin_restates_the_digest() -> None:
    async def run() -> None:
        service, _ = _service()
        await service.ensure_system_account("carter", "firstpass1")

        # A test changed the password through the app; the next boot pins it
        # back, because the admin password must always open the account.
        repinned = await service.ensure_system_account("carter", "secondpass1")
        assert repinned is not None

        signed = await service.sign_in("carter", "secondpass1")
        assert signed.account.user_id == "usr_system_carter"
        with pytest.raises(AuthenticationFailedError):
            await service.sign_in("carter", "firstpass1")

    asyncio.run(run())


def test_a_pin_claims_a_credentialess_row_in_place() -> None:
    async def run() -> None:
        service, repo = _service()
        _seed_orphan(repo, "carter")
        # The data the legacy row carries is what the claim is for.
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

        pinned = await service.ensure_system_account("carter", "adminpass1")

        # The SAME row, claimed: the id - and everything keyed on it -
        # survives, and the admin password opens it.
        assert pinned is not None
        assert pinned.user_id == LEGACY_ID
        kept = await service.get_profile(LEGACY_ID)
        assert kept.sensitivity == 0.004
        signed = await service.sign_in("carter", "adminpass1")
        assert signed.account.user_id == LEGACY_ID

    asyncio.run(run())


def test_a_pin_never_overrides_a_working_credential() -> None:
    async def run() -> None:
        service, _ = _service()
        owner = await service.start_guest()
        held = await service.create_account(
            owner.account.user_id, "carter", "ownerpass1"
        )

        refused = await service.ensure_system_account("carter", "adminpass1")

        assert refused is None
        # The holder's credential is untouched.
        signed = await service.sign_in("carter", "ownerpass1")
        assert signed.account.user_id == held.user_id

    asyncio.run(run())


def test_a_pin_refuses_a_password_that_is_too_short() -> None:
    async def run() -> None:
        service, _ = _service()

        with pytest.raises(ValueError):
            await service.ensure_system_account("carter", "short")

    asyncio.run(run())


def test_the_boot_pins_the_configured_accounts(monkeypatch) -> None:
    monkeypatch.setenv("SYSTEM_ACCOUNT_PASSWORD", "adminpass1")
    from shoot4fun_backend.adapters.inbound.http.app import create_app

    with TestClient(create_app()) as client:
        for name in ("carter", "katael"):
            signed = client.post(
                "/api/account/sign-in",
                json={"display_name": name, "password": "adminpass1"},
            )
            assert signed.status_code == 200, signed.text
            assert signed.json()["registered"] is True


def test_a_boot_without_the_switch_seeds_nothing(monkeypatch) -> None:
    monkeypatch.delenv("SYSTEM_ACCOUNT_PASSWORD", raising=False)
    from shoot4fun_backend.adapters.inbound.http.app import create_app

    with TestClient(create_app()) as client:
        signed = client.post(
            "/api/account/sign-in",
            json={"display_name": "carter", "password": "adminpass1"},
        )
        assert signed.status_code == 401
