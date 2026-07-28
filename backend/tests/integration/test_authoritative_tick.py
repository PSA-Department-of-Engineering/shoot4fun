"""Integration tests for server-authoritative replication (`INT-009`).

Two contracts:

* The server's tick advances room state (respawn timers decrement on
  `tick_all`).
* `apply_input` is a no-op outside the `playing` state - clients
  cannot change position in the lobby or results.
* The room's `apply_input` reflects the server-computed position from
  the `input` message.
"""
from __future__ import annotations

import asyncio

import pytest_intent

from shoot4fun_backend.adapters.outbound.memory.in_memory_leaderboard_repository import (
    InMemoryLeaderboardRepository,
)
from shoot4fun_backend.adapters.outbound.memory.in_memory_room_repository import (
    InMemoryRoomRepository,
)
from shoot4fun_backend.adapters.outbound.websocket.ws_broadcaster import (
    WebSocketBroadcaster,
)
from shoot4fun_backend.application.services.match_service import MatchService
from shoot4fun_backend.domain.model.match_room import TICK_RATE_HZ, MatchRoom


def _build_service() -> tuple[MatchService, InMemoryRoomRepository]:
    repo = InMemoryRoomRepository()
    broadcaster = WebSocketBroadcaster()
    service = MatchService(
        rooms=repo,
        broadcaster=broadcaster,
        leaderboard=InMemoryLeaderboardRepository(),
    )
    return service, repo


class TestAuthoritativeTick:
    @pytest_intent.intent("INT-009")
    def test_tick_runs_at_fixed_rate(self) -> None:
        assert TICK_RATE_HZ == 20

    @pytest_intent.intent("INT-009")
    def test_tick_advances_respawn_timer(self) -> None:
        service, repo = _build_service()
        room = MatchRoom.new(room_id="T01")
        repo.save(room)
        room.add_player("alice")
        room.add_player("bob")
        for p in room.players.values():
            room.set_ready(p.id, True)
        room.start()
        victim = next(p for p in room.players.values() if p.name == "alice")
        victim.health.damage(100)
        before = victim.health.respawn_remaining
        asyncio.run(service.tick_all())
        after = victim.health.respawn_remaining
        assert after < before

    @pytest_intent.intent("INT-009")
    def test_input_is_noop_in_lobby(self) -> None:
        service, repo = _build_service()
        room = MatchRoom.new(room_id="T02")
        repo.save(room)
        player = room.add_player("alice")
        before = player.position
        asyncio.run(service.handle_message(
            "T02",
            player.id,
            {"type": "input", "move": [1.0, 0.0, 0.0], "look": [0.0, 0.0]},
        ))
        after = room.players[player.id].position
        assert after == before

    @pytest_intent.intent("INT-009")
    def test_input_moves_player_in_playing_state(self) -> None:
        service, repo = _build_service()
        room = MatchRoom.new(room_id="T03")
        repo.save(room)
        p1 = room.add_player("alice")
        room.add_player("bob")
        for p in room.players.values():
            room.set_ready(p.id, True)
        room.start()
        before = room.players[p1.id].position
        asyncio.run(service.handle_message(
            "T03",
            p1.id,
            {"type": "input", "move": [0.0, 0.0, 5.0], "look": [0.5, 0.0]},
        ))
        after = room.players[p1.id].position
        assert after != before
        assert room.players[p1.id].yaw == 0.5

    @pytest_intent.intent("INT-009")
    def test_client_cannot_set_position_directly(self) -> None:
        """The server-authoritative contract: position is computed from `input`.

        There is no `position_set` message in the wire protocol. The only
        path to a position change is `input` (a move vector), and the
        server stores `position + move` regardless of the client's local
        view. This test asserts that *no* client message can mutate
        position outside the `input` handler.
        """
        service, repo = _build_service()
        room = MatchRoom.new(room_id="T04")
        repo.save(room)
        p1 = room.add_player("alice")
        room.add_player("bob")
        for p in room.players.values():
            room.set_ready(p.id, True)
        room.start()
        before = room.players[p1.id].position
        for unknown_msg in [
            {"type": "position_set", "position": [100.0, 0.0, 100.0]},
            {"type": "teleport", "x": 100.0, "y": 0.0, "z": 100.0},
            {"type": "set_position", "position": [100.0, 0.0, 100.0]},
        ]:
            asyncio.run(service.handle_message("T04", p1.id, unknown_msg))
        after = room.players[p1.id].position
        assert after == before
