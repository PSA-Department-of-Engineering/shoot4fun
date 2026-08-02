"""The arena catalogue the lobby's map picker is built from.

The point of the endpoint is that the client does not carry its own list
of arena names, so what matters is that the response covers exactly the
arenas a room can actually be set to, and carries the copy the picker
renders. A response that agreed with a hardcoded pair here would prove
nothing, so the expectation is derived from the arenas themselves.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from shoot4fun_backend.adapters.inbound.http.app import create_app
from shoot4fun_backend.domain.model.arena import DEFAULT_ARENAS


def test_catalogue_offers_every_selectable_arena() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/arenas")

    assert response.status_code == 200
    offered = {entry["id"] for entry in response.json()}
    assert offered == set(DEFAULT_ARENAS)


def test_every_offered_arena_carries_its_display_copy() -> None:
    """An entry with no name or blurb renders as a blank card."""
    with TestClient(create_app()) as client:
        entries = client.get("/api/arenas").json()

    for entry in entries:
        assert entry["name"], entry["id"]
        assert entry["blurb"], entry["id"]


def test_the_snapshot_layout_does_not_carry_the_lobby_copy() -> None:
    """The blurb is read once from the catalogue, not 20 times a second."""
    for arena in DEFAULT_ARENAS.values():
        assert "blurb" not in arena.to_dict()
