"""The shop operates strictly over the authenticated account context
(PLAT-001, INT-037).

Acquisitions and equip writes are scoped to the caller's account: a second
account never sees another account's owned items or equipped loadout. The
shop reads/writes ride the same session mechanism as `/api/account/*` -
the one resolution choke point - with no second auth path.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"


def _session(client: TestClient) -> str:
    return client.post("/api/account/guest").json()["token"]


@pytest_intent.intent("INT-037")
def test_acquisitions_are_scoped_per_account(client: TestClient) -> None:
    alice = _session(client)
    bob = _session(client)

    acquired = client.post(
        "/api/shop/acquire", headers={SESSION: alice}, json={"item_id": "mayday"}
    )
    assert acquired.status_code == 200

    # Bob's arsenal carries neither the ownership record nor Alice's equip.
    bob_arsenal = client.get(
        "/api/account/arsenal", headers={SESSION: bob}
    ).json()
    assert all(
        not (isinstance(entry, dict) and entry.get("id") == "mayday")
        for entry in bob_arsenal["data"]["inventory"]
    )
    assert "loadout" not in bob_arsenal["data"]

    # And Bob cannot equip what only Alice owns.
    assert (
        client.post(
            "/api/shop/equip",
            headers={SESSION: bob},
            json={"item_id": "mayday"},
        ).status_code
        == 403
    )


@pytest_intent.intent("INT-037")
def test_shop_rides_the_one_session_mechanism(client: TestClient) -> None:
    """A claimed identity in any other carrier is not an authenticator:
    no session header, no acquisition - whatever else the request says."""
    headers = {"X-S4F-User-Id": "usr_someone"}
    assert (
        client.post("/api/shop/acquire", headers=headers, json={"item_id": "onyx"}).status_code
        == 401
    )
    assert (
        client.get("/api/shop/catalog").status_code == 200  # the read is public
    )
