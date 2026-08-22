"""Ownership is idempotent and entitlement is enforced (ACQ-003, INT-035).

Evaluation order is part of the claim: acquire checks ownership BEFORE any
mutation, so a re-acquire succeeds while leaving both the ownership records
and the equipped loadout unchanged - the first acquisition's auto-equip
fires at most once per item. Only an owned item can be equipped.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"


def _session(client: TestClient) -> str:
    return client.post("/api/account/guest").json()["token"]


@pytest_intent.intent("INT-035")
def test_reacquire_is_a_success_with_no_state_churn(client: TestClient) -> None:
    token = _session(client)
    item = "gold-rush"

    first = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": item}
    )
    assert first.status_code == 200
    before = client.get("/api/account/arsenal", headers={SESSION: token}).json()

    second = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": item}
    )
    assert second.status_code == 200
    assert second.json()["already_owned"] is True
    # The equipped loadout is left exactly as the first acquisition set it.
    assert second.json()["equipped"] == item

    after = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert after["data"] == before["data"]


@pytest_intent.intent("INT-035")
def test_only_an_owned_item_can_be_equipped(client: TestClient) -> None:
    token = _session(client)
    refused = client.post(
        "/api/shop/equip",
        headers={SESSION: token},
        json={"item_id": "gilded-champion"},
    )
    assert refused.status_code == 403

    owned = client.post(
        "/api/shop/acquire",
        headers={SESSION: token},
        json={"item_id": "gilded-champion"},
    )
    assert owned.status_code == 200
    allowed = client.post(
        "/api/shop/equip",
        headers={SESSION: token},
        json={"item_id": "gilded-champion"},
    )
    assert allowed.status_code == 200


@pytest_intent.intent("INT-035")
async def test_concurrent_shop_writes_do_not_lose_records() -> None:
    """Overlapping shop writes for one account serialize on the SHARED
    per-user locks the container owns.

    The stub repository yields at get and save, forcing the interleaving a
    real asyncpg pool produces; with unsynchronized writers, two acquires
    of DIFFERENT items both answer success while the whole-envelope upsert
    silently keeps only one record. The wiring under test mirrors
    production: per-request use-case instances sharing one lock registry.
    """
    import asyncio

    from shoot4fun_backend.adapters.outbound.memory.in_memory_account_repository import (
        InMemoryAccountRepository,
    )
    from shoot4fun_backend.application.use_cases.acquire_item import (
        AcquireItem,
        ShopWriteLocks,
    )
    from shoot4fun_backend.container import _CATALOG_PATH
    from shoot4fun_backend.domain.model.shop import load_catalog

    class SuspendingRepo(InMemoryAccountRepository):
        async def get_arsenal(self, user_id: str) -> dict | None:
            await asyncio.sleep(0)
            return await super().get_arsenal(user_id)

        async def save_arsenal(self, user_id: str, envelope: dict) -> None:
            await asyncio.sleep(0)
            await super().save_arsenal(user_id, envelope)

    repo = SuspendingRepo()
    await repo.create_guest("usr_racer", "RacerOne")
    catalog = load_catalog(_CATALOG_PATH)

    # Per-request construction over ONE shared registry - the container's
    # shape. Two instances must still serialize against each other.
    locks = ShopWriteLocks()

    async def acquire_via_request():
        return await AcquireItem(repo, catalog, locks).execute(
            "usr_racer", "onyx"
        )

    async def acquire_other_via_request():
        return await AcquireItem(repo, catalog, locks).execute(
            "usr_racer", "mayday"
        )

    results = await asyncio.gather(acquire_via_request(), acquire_other_via_request())
    assert all(result.already_owned is False for result in results)

    stored = await repo.get_arsenal("usr_racer")
    owned_ids = {
        entry.get("id")
        for entry in stored["data"]["inventory"]
        if isinstance(entry, dict)
    }
    assert owned_ids == {"onyx", "mayday"}
