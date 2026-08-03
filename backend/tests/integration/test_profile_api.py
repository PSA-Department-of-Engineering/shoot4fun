"""HTTP integration tests for the profile API (`INT-018`).

The surface a client actually calls: create, read, patch, the 409 on a
second creation, the 404s, and the leaderboard attribution (a score
posted with a `user_id` comes back carrying it).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from shoot4fun_backend.adapters.inbound.http.app import create_app


def test_create_read_patch_round_trip() -> None:
    with TestClient(create_app()) as client:
        created = client.post(
            "/api/users",
            json={"username": "sniper", "display_name": "Sniper", "sensitivity": 0.003},
        )
        assert created.status_code == 201
        profile = created.json()
        assert profile["username"] == "sniper"
        assert profile["display_name"] == "Sniper"
        assert profile["sensitivity"] == 0.003
        assert profile["master_volume"] == 0.7  # client defaults

        read = client.get("/api/users/sniper")
        assert read.status_code == 200
        assert read.json()["id"] == profile["id"]

        patched = client.patch(
            "/api/users/sniper", json={"master_volume": 0.9, "sfx_volume": 0.2}
        )
        assert patched.status_code == 200
        assert patched.json()["master_volume"] == 0.9
        assert patched.json()["sensitivity"] == 0.003


def test_display_name_defaults_to_username() -> None:
    with TestClient(create_app()) as client:
        created = client.post("/api/users", json={"username": "anonymous"})
        assert created.status_code == 201
        assert created.json()["display_name"] == "anonymous"


def test_second_creation_of_username_is_409() -> None:
    with TestClient(create_app()) as client:
        first = client.post("/api/users", json={"username": "sniper"})
        assert first.status_code == 201
        second = client.post("/api/users", json={"username": "sniper"})
        assert second.status_code == 409


def test_unknown_username_answers_404() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/api/users/nobody").status_code == 404
        assert client.patch("/api/users/nobody", json={"display_name": "Ghost"}).status_code == 404


def test_out_of_bounds_preferences_are_refused() -> None:
    with TestClient(create_app()) as client:
        assert (
            client.post(
                "/api/users", json={"username": "x", "master_volume": 1.5}
            ).status_code
            == 422
        )
        assert (
            client.patch(
                "/api/users/x", json={"sensitivity": 0.0}
            ).status_code
            == 422
        )


def test_leaderboard_score_carries_its_profile_attribution() -> None:
    with TestClient(create_app()) as client:
        created = client.post("/api/users", json={"username": "sniper"}).json()
        posted = client.post(
            "/api/leaderboard/sandbox/score",
            json={"holder_name": "Sniper", "score": 42, "user_id": created["id"]},
        )
        assert posted.status_code == 200
        assert posted.json()["user_id"] == created["id"]

        best = client.get("/api/leaderboard/sandbox").json()
        assert best["user_id"] == created["id"]

        # A lower guest score keeps the attributed best entry; a higher
        # guest score replaces it and carries no attribution.
        guest_low = client.post(
            "/api/leaderboard/sandbox/score",
            json={"holder_name": "Guest", "score": 1},
        )
        assert guest_low.status_code == 200
        assert guest_low.json()["user_id"] == created["id"]

        guest_high = client.post(
            "/api/leaderboard/sandbox/score",
            json={"holder_name": "Guest", "score": 99},
        )
        assert guest_high.status_code == 200
        assert guest_high.json()["user_id"] is None
        assert guest_high.json()["holder_name"] == "Guest"
