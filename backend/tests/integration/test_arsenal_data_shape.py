"""The Arsenal data shape is forward-compatible (ARS-004, INT-029).

The inventory/loadout envelope must preserve unknown fields, so a future
that adds weapon unlocks, outfits, or stats grows the shape without losing
a player's existing data. The test posts an over-shaped payload (fields the
current build does not name) and proves every one of them survives a round
trip through the stored envelope unchanged.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"


def _registered(client: TestClient) -> str:
    """A fresh guest, upgraded to a registered account, returns its token."""
    guest = client.post("/api/account/guest").json()
    token = guest["token"]
    client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "ArsenalOwner"},
    )
    return token


@pytest_intent.intent("INT-029")
def test_arsenal_envelope_preserves_unknown_fields(client: TestClient) -> None:
    token = _registered(client)

    # A fresh account has the default envelope: version 1, empty loadout.
    fresh = client.get("/api/account/arsenal", headers={SESSION: token})
    assert fresh.status_code == 200
    body = fresh.json()
    assert body["version"] == 1
    assert body["loadout"] == {}

    # An over-shaped payload: fields the current build does not name
    # (weapon_unlocks, outfits, stats) alongside the known ones.
    over_shaped = {
        "version": 1,
        "model": "robot",
        "loadout": {"primary": "rifle", "secondary": "smg"},
        "weapon_unlocks": ["shotgun", "sniper"],
        "outfits": {"default": "crimson"},
        "stats": {"kills": 12, "matches": 3},
    }
    put = client.put(
        "/api/account/arsenal", headers={SESSION: token}, json=over_shaped
    )
    assert put.status_code == 200

    # The stored envelope round-trips every field, known and unknown.
    stored = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert stored["version"] == 1
    assert stored["model"] == "robot"
    assert stored["loadout"] == {"primary": "rifle", "secondary": "smg"}
    # The forward-shaped fields are preserved ver batim.
    assert stored["weapon_unlocks"] == ["shotgun", "sniper"]
    assert stored["outfits"] == {"default": "crimson"}
    assert stored["stats"] == {"kills": 12, "matches": 3}


@pytest_intent.intent("INT-029")
def test_arsenal_envelope_survives_additional_unknown_fields(client: TestClient) -> None:
    """A second, larger write must not drop fields a prior write carried.

    A future shape is allowed to keep growing; the older client that wrote
    `future_flag` must still see it after a newer client adds `another_flag`."""
    token = _registered(client)

    client.put(
        "/api/account/arsenal",
        headers={SESSION: token},
        json={"version": 1, "model": "robot", "loadout": {}, "future_flag": True},
    )
    client.put(
        "/api/account/arsenal",
        headers={SESSION: token},
        json={
            "version": 1,
            "model": "robot",
            "loadout": {},
            "future_flag": True,
            "another_flag": 7,
        },
    )
    stored = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert stored["future_flag"] is True
    assert stored["another_flag"] == 7
