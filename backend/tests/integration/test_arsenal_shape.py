"""The Arsenal data shape is forward-compatible (ARS-004, ADR-0007).

`INT-029`. The envelope wraps an opaque `data` object, so a future that adds
weapon unlocks, outfits, or stats must not lose what a player already has. The
test round-trips an over-shaped payload through the service and its store and
asserts the unknown fields survive, and that a newer envelope version is still
readable.
"""
from __future__ import annotations

import asyncio

import pytest_intent

from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
    InMemoryAccountRepository,
)
from shoot4fun_backend.application.services.account_service import AccountService
from shoot4fun_backend.domain.model.arsenal import ArsenalEnvelope


@pytest_intent.intent("INT-029")
def test_an_over_shaped_payload_round_trips_without_loss() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo)
        guest = await service.start_guest()

        # A future client writes fields today's shape does not know.
        future = {
            "version": 1,
            "data": {
                "model": "robot",
                "inventory": [],
                "weapon_unlocks": ["vintage_rifle", "neon_smg"],
                "outfits": {"default": "clean", "event": "aurora"},
                "stats": {"matches": 12, "kills": 73},
            },
        }
        saved = await service.save_arsenal(guest.account.user_id, future)
        loaded = await service.get_arsenal(guest.account.user_id)

        assert loaded == saved
        # The known fields are intact...
        assert loaded["version"] == 1
        assert loaded["data"]["model"] == "robot"
        # ...and the unknown future fields were not dropped.
        assert loaded["data"]["weapon_unlocks"] == ["vintage_rifle", "neon_smg"]
        assert loaded["data"]["outfits"] == {"default": "clean", "event": "aurora"}
        assert loaded["data"]["stats"] == {"matches": 12, "kills": 73}

        # Re-emitting the loaded envelope preserves it identically.
        envelope = ArsenalEnvelope.parse(loaded)
        assert ArsenalEnvelope.parse(envelope.to_dict()).data == loaded["data"]

    asyncio.run(run())


@pytest_intent.intent("INT-029")
def test_a_newer_envelope_version_is_still_readable() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo)
        guest = await service.start_guest()

        # A v2 payload (today's client has never seen v2) must still parse and
        # store, so the shape can grow without a breaking change.
        v2 = {
            "version": 2,
            "data": {"model": "robot", "inventory": [], "cosmetics": ["future"]},
        }
        await service.save_arsenal(guest.account.user_id, v2)
        loaded = await service.get_arsenal(guest.account.user_id)

        assert loaded["version"] == 2
        assert loaded["data"]["cosmetics"] == ["future"]

        # A malformed envelope is refused at the edge, never stored.
        import pytest as _pytest

        with _pytest.raises(ValueError):
            ArsenalEnvelope.parse({"data": {}})
        with _pytest.raises(ValueError):
            ArsenalEnvelope.parse({"version": 1, "data": []})

    asyncio.run(run())


@pytest_intent.intent("INT-029")
def test_an_ill_formed_stored_payload_is_refused_on_read() -> None:
    async def run() -> None:
        repo = InMemoryAccountRepository()
        service = AccountService(repo)
        guest = await service.start_guest()

        # Corrupt the store behind the service's back: the read path validates
        # through the domain model, so a caller never sees an ill-formed
        # envelope.
        import pytest as _pytest

        await repo.save_arsenal(guest.account.user_id, {"data": {}})
        with _pytest.raises(ValueError):
            await service.get_arsenal(guest.account.user_id)

    asyncio.run(run())
