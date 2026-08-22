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
