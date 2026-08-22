"""Shop writes respect the Arsenal envelope contract (PLAT-002, INT-038).

After acquisitions and equip writes, the stored envelope keeps its original
`version` and preserves unknown keys inside `data` byte-for-byte, so an
over-shaped payload still round-trips losslessly through a post-shop read.
This extends INT-029's contract across the new writer: the shop's own
writes never violate what the envelope guarantees. The tests run against
the real acquire/equip use cases, not mocks.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

SESSION = "X-S4F-Session"

# Fields a FUTURE shape owns, written before the shop ever touches the
# envelope. Nothing in the current build names them.
FOREIGN_DATA = {
    "model": "robot",
    "inventory": [],
    "weapon_unlocks": ["shotgun", "sniper"],
    "outfits": {"default": "crimson"},
    "stats": {"kills": 12, "matches": 3},
}


def _envelope_with_foreign_fields(client: TestClient, token: str) -> None:
    put = client.put(
        "/api/account/arsenal",
        headers={SESSION: token},
        json={"version": 1, "data": FOREIGN_DATA},
    )
    assert put.status_code == 200


@pytest_intent.intent("INT-038")
def test_acquire_preserves_version_and_unknown_keys(client: TestClient) -> None:
    token = client.post("/api/account/guest").json()["token"]
    _envelope_with_foreign_fields(client, token)

    acquired = client.post(
        "/api/shop/acquire",
        headers={SESSION: token},
        json={"item_id": "sandstone"},
    )
    assert acquired.status_code == 200

    stored = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert stored["version"] == 1
    # The ownership record landed...
    entries = [
        entry
        for entry in stored["data"]["inventory"]
        if isinstance(entry, dict) and entry.get("id") == "sandstone"
    ]
    assert len(entries) == 1
    # ...and every foreign key survived byte-for-byte.
    for key, value in FOREIGN_DATA.items():
        if key == "inventory":
            continue
        assert stored["data"][key] == value, key


@pytest_intent.intent("INT-038")
def test_equip_preserves_version_and_unknown_keys(client: TestClient) -> None:
    token = client.post("/api/account/guest").json()["token"]
    _envelope_with_foreign_fields(client, token)
    assert (
        client.post(
            "/api/shop/acquire",
            headers={SESSION: token},
            json={"item_id": "cobalt-frost"},
        ).status_code
        == 200
    )
    equipped = client.post(
        "/api/shop/equip",
        headers={SESSION: token},
        json={"item_id": "cobalt-frost"},
    )
    assert equipped.status_code == 200

    stored = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert stored["version"] == 1
    assert stored["data"]["loadout"]["cosmetic"] == "cobalt-frost"
    for key, value in FOREIGN_DATA.items():
        if key == "inventory":
            continue
        assert stored["data"][key] == value, key


@pytest_intent.intent("INT-038")
def test_reacquire_leaves_the_envelope_untouched(client: TestClient) -> None:
    """The idempotent path performs no write at all: an over-shaped payload
    round-trips unchanged through it."""
    token = client.post("/api/account/guest").json()["token"]
    _envelope_with_foreign_fields(client, token)
    item = "graphite-edge"
    assert (
        client.post(
            "/api/shop/acquire", headers={SESSION: token}, json={"item_id": item}
        ).status_code
        == 200
    )
    before = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    again = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": item}
    )
    assert again.status_code == 200
    after = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    assert after == before


@pytest_intent.intent("INT-038")
def test_legacy_string_inventory_entries_survive_acquisition(
    client: TestClient,
) -> None:
    """A legacy plain-string inventory entry (none exist today) must not
    crash the join or be dropped by an acquisition."""
    token = client.post("/api/account/guest").json()["token"]
    put = client.put(
        "/api/account/arsenal",
        headers={SESSION: token},
        json={"version": 1, "data": {"model": "robot", "inventory": ["old-string-item"]}},
    )
    assert put.status_code == 200

    acquired = client.post(
        "/api/shop/acquire", headers={SESSION: token}, json={"item_id": "drab-canvas"}
    )
    assert acquired.status_code == 200

    stored = client.get("/api/account/arsenal", headers={SESSION: token}).json()
    inventory = stored["data"]["inventory"]
    assert "old-string-item" in inventory
    assert any(
        isinstance(entry, dict) and entry.get("id") == "drab-canvas"
        for entry in inventory
    )
