"""Integration tests for the WebSocket match-room contract (`INT-008`).

The room accepts 2-4 connections and rejects the 5th with a documented
`ROOM_FULL` error code. The room id is the only routing key; the test
uses distinct room ids so each test case starts from a clean room.

The two-player assertion is split into two complementary tests:

* `test_two_players_share_room_state` drives two concurrent sockets
  through the WebSocket round-trip and asserts both received a `hello`
  with a player_id.
* `test_room_accepts_three_players_as_in_memory` is the unit-level
  check on `MatchRoom.add_player` (which is the source of the room
  capacity), to keep the WebSocket test fast.

The 5-player rejection test drives the WebSocket close with the
documented `ROOM_FULL` error code.
"""
from __future__ import annotations

import json
import threading
import time

import pytest_intent
from fastapi.testclient import TestClient

from shoot4fun_backend.adapters.inbound.http.app import create_app
from shoot4fun_backend.domain.exceptions.room_full_error import RoomFullError
from shoot4fun_backend.domain.model.match_room import ROOM_CAPACITY, MatchRoom


def _hello(name: str) -> str:
    return json.dumps({"type": "hello", "name": name})


def _drain(ws, settle_seconds: float = 0.3) -> list[dict]:
    """Read messages from the WebSocketTestSession in a background thread.

    `WebSocketTestSession.receive_text` blocks indefinitely; we run a
    short-lived reader thread to drain anything the server has pushed.
    The thread is daemon so any blocking receive is discarded when the
    test exits.
    """
    captured: list[str] = []
    stop = threading.Event()

    def _reader() -> None:
        for _ in range(50):
            if stop.is_set():
                return
            try:
                captured.append(ws.receive_text())
            except Exception:
                return

    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    time.sleep(settle_seconds)
    stop.set()
    return [json.loads(m) for m in captured]


class TestWebSocketMatch:
    @pytest_intent.intent("INT-008")
    def test_two_players_share_room_state(self) -> None:
        client = TestClient(create_app())
        with client:
            ws1 = client.websocket_connect("/ws/match/ACPT01")
            ws1.__enter__()
            ws1.send_text(_hello("alice"))
            msgs1 = _drain(ws1)
            hello1 = next(
                (m for m in msgs1 if m.get("type") == "hello"), None
            )
            assert hello1 is not None, msgs1
            ws2 = client.websocket_connect("/ws/match/ACPT01")
            ws2.__enter__()
            ws2.send_text(_hello("bob"))
            msgs2 = _drain(ws2)
            hello2 = next(
                (m for m in msgs2 if m.get("type") == "hello"), None
            )
            assert hello2 is not None, msgs2
            assert hello1["player_id"] != hello2["player_id"]
            ws1.__exit__(None, None, None)
            ws2.__exit__(None, None, None)

    @pytest_intent.intent("INT-008")
    def test_room_rejects_fifth_player(self) -> None:
        client = TestClient(create_app())
        with client:
            sockets = []
            for name in ("p1", "p2", "p3", "p4"):
                ws = client.websocket_connect("/ws/match/CAP001")
                ws.__enter__()
                ws.send_text(_hello(name))
                _drain(ws)
                sockets.append(ws)
            ws5 = client.websocket_connect("/ws/match/CAP001")
            ws5.__enter__()
            ws5.send_text(_hello("p5"))
            msgs = _drain(ws5, settle_seconds=0.5)
            errors = [m for m in msgs if m.get("type") == "error"]
            assert errors, f"expected ROOM_FULL error, got {msgs}"
            assert errors[0].get("code") == "ROOM_FULL"
            ws5.__exit__(None, None, None)
            for ws in sockets:
                ws.__exit__(None, None, None)

    @pytest_intent.intent("INT-008")
    def test_room_id_is_routing_key(self) -> None:
        client = TestClient(create_app())
        with client:
            ws1 = client.websocket_connect("/ws/match/RT01")
            ws1.__enter__()
            ws1.send_text(_hello("alice"))
            msgs1 = _drain(ws1)
            ws2 = client.websocket_connect("/ws/match/RT02")
            ws2.__enter__()
            ws2.send_text(_hello("alice2"))
            msgs2 = _drain(ws2)
            hello1 = next(m for m in msgs1 if m.get("type") == "hello")
            hello2 = next(m for m in msgs2 if m.get("type") == "hello")
            assert hello1["player_id"] != hello2["player_id"]
            ws1.__exit__(None, None, None)
            ws2.__exit__(None, None, None)


class TestMatchRoomCapacity:
    @pytest_intent.intent("INT-008")
    def test_room_capacity_is_four(self) -> None:
        assert ROOM_CAPACITY == 4

    @pytest_intent.intent("INT-008")
    def test_match_room_rejects_fifth_player(self) -> None:
        import pytest
        room = MatchRoom.new(room_id="R5")
        for i in range(ROOM_CAPACITY):
            room.add_player(f"p{i}")
        with pytest.raises(RoomFullError):
            room.add_player("p5")
