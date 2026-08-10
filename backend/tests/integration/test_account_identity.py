"""The account lifecycle and the session as the sole authenticator.

`INT-019` (a guest is an account, registration upgrades it in place),
`INT-020` (the session is the only authenticator; secrets are digests),
`INT-021` (attribution comes from the account, and the profile follows it).

These run over the HTTP surface rather than the service, because the claims are
about what a caller can and cannot do, and a caller only ever has the HTTP
surface. A test that authenticates by reaching past it is not testing
authentication.
"""
from __future__ import annotations

import pytest_intent
from fastapi.testclient import TestClient

from shoot4fun_backend.adapters.inbound.http.app import create_app
from shoot4fun_backend.domain.model.player_profile import (
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
)
from shoot4fun_backend.domain.model.recovery_code import hash_secret

SESSION = "X-S4F-Session"


def _guest(client: TestClient) -> tuple[str, str]:
    """A fresh guest account and its session token."""
    body = client.post("/api/account/guest").json()
    return body["user_id"], body["token"]


@pytest_intent.intent("INT-019")
def test_a_guest_is_an_account_and_registration_upgrades_it(client: TestClient) -> None:
    created = client.post("/api/account/guest")
    assert created.status_code == 201
    guest = created.json()
    user_id, token = guest["user_id"], guest["token"]

    # A guest is a real account: opaque non-derived id, a name, not registered.
    assert user_id.startswith("usr_")
    assert guest["display_name"]
    assert guest["registered"] is False
    assert guest["display_name"] not in user_id  # the id is not derived from the name

    registered = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "AimBotanist"},
    )
    assert registered.status_code == 200
    body = registered.json()
    # The SAME account, upgraded in place: everything set as a guest survives.
    assert body["user_id"] == user_id
    assert body["registered"] is True
    code = body["recovery_code"]
    assert code.startswith("s4f_")

    # Re-registering is a rename and mints nothing: a session alone must not be
    # able to retire the owner's written-down code.
    renamed = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "AimBotanist2"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["recovery_code"] == ""
    assert renamed.json()["user_id"] == user_id

    # The original code still signs in, from a device holding no session.
    signed = client.post(
        "/api/account/sign-in",
        json={"display_name": "AimBotanist2", "recovery_code": code},
    )
    assert signed.status_code == 200
    assert signed.json()["user_id"] == user_id


@pytest_intent.intent("INT-019")
def test_rotation_requires_the_current_code_and_kills_every_session(
    client: TestClient,
) -> None:
    _, token = _guest(client)
    code = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "RotatingRanger"},
    ).json()["recovery_code"]

    # A second device signs in, so there are two live sessions.
    other = client.post(
        "/api/account/sign-in",
        json={"display_name": "RotatingRanger", "recovery_code": code},
    ).json()["token"]
    assert client.get("/api/account/me", headers={SESSION: other}).status_code == 200

    # The wrong code rotates nothing.
    assert (
        client.post(
            "/api/account/rotate",
            headers={SESSION: token},
            json={"current_code": "s4f_wrong"},
        ).status_code
        == 401
    )

    rotated = client.post(
        "/api/account/rotate", headers={SESSION: token}, json={"current_code": code}
    )
    assert rotated.status_code == 200
    fresh = rotated.json()
    assert fresh["recovery_code"] != code

    # Every previously issued session is dead, including the one that rotated.
    assert client.get("/api/account/me", headers={SESSION: other}).status_code == 401
    assert client.get("/api/account/me", headers={SESSION: token}).status_code == 401
    # The caller keeps a working session so it is not signed out of this device.
    assert client.get("/api/account/me", headers={SESSION: fresh["token"]}).status_code == 200
    # The replaced code no longer opens the account.
    assert (
        client.post(
            "/api/account/sign-in",
            json={"display_name": "RotatingRanger", "recovery_code": code},
        ).status_code
        == 401
    )


@pytest_intent.intent("INT-019")
def test_a_display_name_another_account_holds_is_refused(client: TestClient) -> None:
    _, first = _guest(client)
    client.post(
        "/api/account/register", headers={SESSION: first}, json={"display_name": "OnlyOne"}
    )
    _, second = _guest(client)
    clash = client.post(
        "/api/account/register",
        headers={SESSION: second},
        json={"display_name": "onlyone"},
    )
    assert clash.status_code == 409


@pytest_intent.intent("INT-020")
def test_only_a_session_reaches_private_data(client: TestClient) -> None:
    user_id, token = _guest(client)

    private = ["/api/account/me", "/api/account/profile"]
    # No credential, a made-up token, and the two shapes of claimed identity are
    # all unauthenticated. A published id must never be accepted as proof.
    for headers in (
        {},
        {SESSION: "not-a-real-token"},
        {SESSION: user_id},
        {"X-Auth-Request-User": user_id},
        {"Authorization": f"Bearer {user_id}"},
    ):
        for path in private:
            assert client.get(path, headers=headers).status_code == 401, (headers, path)

    # A valid session resolves to exactly its own account, on either carrier.
    assert client.get("/api/account/me", headers={SESSION: token}).json()["user_id"] == user_id
    bearer = client.get("/api/account/me", headers={"Authorization": f"Bearer {token}"})
    assert bearer.json()["user_id"] == user_id


@pytest_intent.intent("INT-020")
def test_no_response_carries_a_secret_or_its_digest(client: TestClient) -> None:
    _, token = _guest(client)
    minted = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "QuietRecord"},
    ).json()
    code = minted["recovery_code"]
    digest = hash_secret(code)

    # Assert on the VALUES across every account-shaped read. Checking a field by
    # name would pass a response that leaked the digest under its own name, and
    # the digest is the secret for anyone who can sweep it.
    reads = [
        client.get("/api/account/me", headers={SESSION: token}),
        client.get("/api/account/profile", headers={SESSION: token}),
        client.get("/api/leaderboard/dust"),
    ]
    for response in reads:
        text = response.text
        assert code not in text
        assert digest not in text
        assert hash_secret(token) not in text


@pytest_intent.intent("INT-020")
def test_a_guessing_caller_runs_out_of_budget(client: TestClient) -> None:
    _, token = _guest(client)
    code = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "Bud Get"},
    ).json()["recovery_code"]

    refused = False
    for i in range(40):
        # Each attempt respells the name. The lookup collapses whitespace runs,
        # so a key derived any other way would hand this caller a fresh bucket
        # per spelling and the budget would be decorative.
        padded = "Bud" + (" " * (i + 1)) + "Get"
        attempt = client.post(
            "/api/account/sign-in",
            json={"display_name": padded, "recovery_code": f"s4f_bad{i}"},
        )
        if attempt.status_code == 429:
            refused = True
            break
    assert refused

    # The refusal outlasts a correct code: spending the budget then walking in
    # is exactly what the budget exists to stop.
    assert (
        client.post(
            "/api/account/sign-in",
            json={"display_name": "Bud Get", "recovery_code": code},
        ).status_code
        == 429
    )


@pytest_intent.intent("INT-020")
def test_signing_out_revokes_the_session_server_side(client: TestClient) -> None:
    _, token = _guest(client)
    assert client.get("/api/account/me", headers={SESSION: token}).status_code == 200
    assert client.post("/api/account/sign-out", headers={SESSION: token}).status_code == 204
    # Discarding the token client-side is not a sign-out; the row has to go.
    assert client.get("/api/account/me", headers={SESSION: token}).status_code == 401


@pytest_intent.intent("INT-021")
def test_a_signed_in_score_is_attributed_to_the_account(client: TestClient) -> None:
    _, token = _guest(client)
    client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "RealHolder"},
    )

    # The body's holder_name is ignored for an authenticated caller: trusting it
    # would let anyone post a score under anyone's name.
    posted = client.post(
        "/api/leaderboard/dust/score",
        headers={SESSION: token},
        json={"holder_name": "SomeoneElse", "score": 42},
    )
    assert posted.status_code == 200
    board = client.get("/api/leaderboard/dust").json()
    assert board["holder_name"] == "RealHolder"

    # A guest keeps posting a name with the score, and it stays unowned.
    client.post(
        "/api/leaderboard/dust/score",
        json={"holder_name": "PassingStranger", "score": 99},
    )
    assert client.get("/api/leaderboard/dust").json()["holder_name"] == "PassingStranger"


@pytest_intent.intent("INT-021")
def test_the_profile_follows_the_account_to_another_device(client: TestClient) -> None:
    _, token = _guest(client)
    code = client.post(
        "/api/account/register",
        headers={SESSION: token},
        json={"display_name": "Dialled In"},
    ).json()["recovery_code"]

    saved = client.put(
        "/api/account/profile",
        headers={SESSION: token},
        json={
            "sensitivity": 0.004,
            "touch_sensitivity": 0.006,
            "master_volume": 0.3,
            "sfx_volume": 0.55,
            "haptics_enabled": False,
        },
    )
    assert saved.status_code == 200

    # A second device presenting a session gets the same dials, already set.
    other = client.post(
        "/api/account/sign-in",
        json={"display_name": "Dialled In", "recovery_code": code},
    ).json()["token"]
    elsewhere = client.get("/api/account/profile", headers={SESSION: other}).json()
    assert elsewhere["sensitivity"] == 0.004
    assert elsewhere["master_volume"] == 0.3
    assert elsewhere["haptics_enabled"] is False


@pytest_intent.intent("INT-021")
def test_an_out_of_range_preference_is_clamped_not_stored(client: TestClient) -> None:
    _, token = _guest(client)
    saved = client.put(
        "/api/account/profile",
        headers={SESSION: token},
        json={
            "sensitivity": 99.0,
            "touch_sensitivity": -1.0,
            "master_volume": 5.0,
            "sfx_volume": -0.2,
            "haptics_enabled": True,
        },
    ).json()
    # Clamped on the way in, so no reader has to defend against it forever, and
    # clamped to the range the client's own dial offers.
    assert saved["sensitivity"] == SENSITIVITY_MAX
    assert saved["touch_sensitivity"] == SENSITIVITY_MIN
    assert saved["master_volume"] == 1.0
    assert saved["sfx_volume"] == 0.0


def test_two_apps_do_not_share_a_guest(client: TestClient) -> None:
    """A guard on the fixture rather than a claim: each TestClient builds its
    own container, so a leak here would make every test above pass for the
    wrong reason."""
    other = TestClient(create_app())
    _, token = _guest(client)
    assert other.get("/api/account/me", headers={SESSION: token}).status_code == 401
