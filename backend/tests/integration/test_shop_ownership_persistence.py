"""Acquired items persist in the Arsenal envelope (ACQ-002, INT-034).

The ownership record rides the existing account/Arsenal repository - no
second store, no migration - so it survives sign-out and sign-in on any
client. (The visible-population half of the claim carries an additional
e2e marker on the unlock journey: apps/client/e2e/shop.spec.ts asserts the
Arsenal inventory lists the acquired item.)
"""
from __future__ import annotations

import uuid

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"


def _registered_session(client: TestClient) -> tuple[str, str]:
    """A guest upgraded to a registered account; returns (token, name)."""
    guest = client.post("/api/account/guest").json()
    token = guest["token"]
    name = f"Owner{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/account/create",
        headers={SESSION: token},
        json={"display_name": name, "password": "correct horse battery"},
    )
    return token, name


@pytest_intent.intent("INT-034")
def test_acquisition_survives_sign_out_and_sign_in(client: TestClient) -> None:
    token, display_name = _registered_session(client)

    acquired = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": "onyx"}
    )
    assert acquired.status_code == 200

    # Sign out, then back in on a "new device" (a fresh session).
    assert (
        client.post("/api/account/sign-out", headers={SESSION: token}).status_code
        == 204
    )
    signed_in = client.post(
        "/api/account/sign-in",
        json={"display_name": display_name, "password": "correct horse battery"},
    )
    assert signed_in.status_code == 200
    new_token = signed_in.json()["token"]

    arsenal = client.get("/api/account/arsenal", headers={SESSION: new_token}).json()
    owned = [
        entry
        for entry in arsenal["data"]["inventory"]
        if isinstance(entry, dict) and entry.get("id") == "onyx"
    ]
    assert len(owned) == 1
    assert owned[0]["acquired_at"]
