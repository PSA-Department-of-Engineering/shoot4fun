"""Acquisition writes ownership into the Arsenal envelope (ACQ-001/002).

`POST /api/shop/acquire` over an authenticated session appends the
ownership record `{ id, acquired_at }` to `data.inventory`; presence in the
collection IS ownership. An unauthenticated call is refused with 401 before
any state changes.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"


def _session(client: TestClient) -> str:
    return client.post("/api/account/guest").json()["token"]


@pytest_intent.intent("INT-033")
def test_acquire_requires_a_session_and_refuses_before_state(
    client: TestClient,
) -> None:
    unauthenticated = client.post(
        "/api/shop/acquire", json={"item_id": "hot-sauce"}
    )
    assert unauthenticated.status_code == 401


@pytest_intent.intent("INT-033")
def test_acquire_writes_the_ownership_record(client: TestClient) -> None:
    token = _session(client)
    response = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": "hot-sauce"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["item_id"] == "hot-sauce"
    assert body["already_owned"] is False
    # First acquisition auto-equips (the design's unlock-and-apply).
    assert body["equipped"] == "hot-sauce"

    arsenal = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    entries = [
        entry
        for entry in arsenal["data"]["inventory"]
        if isinstance(entry, dict) and entry.get("id") == "hot-sauce"
    ]
    assert len(entries) == 1
    assert set(entries[0]) == {"id", "acquired_at"}


@pytest_intent.intent("INT-033")
def test_acquire_of_an_unknown_item_is_refused(client: TestClient) -> None:
    token = _session(client)
    response = client.post(
        "/api/shop/acquire",
        headers={SESSION: token},
        json={"item_id": "not-a-real-item"},
    )
    assert response.status_code == 404
