"""Server-authoritative simulation (`INT-009`), per `ADR-0003`.

These assert the property the architecture claims, which is not "the
server stores the position" but "the client cannot author it". The
distinguishing question for every test here is: what is the best a
lying client can do?

A client controls three things on the wire: how many input frames it
sends, what `dt` each one claims, and what it says about its look. So
the guards are a real-time budget (frame count cannot buy distance), a
per-frame clamp (a long claimed frame cannot buy distance), and a world
the server tests the look against rather than trusting a declared
outcome.
"""
from __future__ import annotations

import asyncio
import math

import pytest
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
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.match_room import SIM_TICK_HZ, MatchRoom
from shoot4fun_backend.domain.model.movement import MOVE_SPEED
from shoot4fun_backend.domain.model.vec3 import Vec3

DT = 1.0 / SIM_TICK_HZ


def _build_service() -> tuple[MatchService, InMemoryRoomRepository]:
    repo = InMemoryRoomRepository()
    return (
        MatchService(
            rooms=repo,
            broadcaster=WebSocketBroadcaster(),
            leaderboard=InMemoryLeaderboardRepository(),
        ),
        repo,
    )


def _started_room(room_id: str) -> tuple[MatchRoom, str, str]:
    room = MatchRoom.new(room_id=room_id)
    alice = room.add_player("alice")
    bob = room.add_player("bob")
    for player in room.players.values():
        room.set_ready(player.id, True)
    room.start()
    return room, alice.id, bob.id


def _walk(
    room: MatchRoom, player_id: str, seconds: float, frames_per_tick: int = 1
) -> None:
    """Advance `seconds` of real time, sending `frames_per_tick` inputs a tick."""
    seq = 0
    for _ in range(int(seconds * SIM_TICK_HZ)):
        room.advance(DT)
        for _ in range(frames_per_tick):
            seq += 1
            room.apply_input(
                player_id, InputFrame(seq=seq, dt=DT, forward=True, yaw=0.0)
            )


class TestAuthoritativeSimulation:
    @pytest_intent.intent("INT-009")
    def test_one_second_of_input_moves_exactly_one_second_of_travel(self) -> None:
        room, alice, _ = _started_room("T01")
        start = room.players[alice].position
        _walk(room, alice, seconds=1.0)
        travelled = abs(room.players[alice].position.z - start.z)
        assert travelled == pytest.approx(MOVE_SPEED)

    @pytest_intent.intent("INT-009")
    def test_flooding_input_frames_buys_no_extra_distance(self) -> None:
        """The speed hack a per-frame clamp alone does not stop.

        Ten legal frames per tick is ten times the honest client's
        traffic and must still travel exactly one second's distance.
        """
        honest, alice_a, _ = _started_room("T02")
        cheat, alice_b, _ = _started_room("T03")
        start = honest.players[alice_a].position

        _walk(honest, alice_a, seconds=1.0, frames_per_tick=1)
        _walk(cheat, alice_b, seconds=1.0, frames_per_tick=10)

        assert cheat.players[alice_b].position.z == pytest.approx(
            honest.players[alice_a].position.z
        )
        assert abs(honest.players[alice_a].position.z - start.z) == pytest.approx(
            MOVE_SPEED
        )

    @pytest_intent.intent("INT-009")
    def test_claiming_a_long_frame_buys_no_extra_distance(self) -> None:
        room, alice, _ = _started_room("T04")
        start = room.players[alice].position
        for seq in range(1, SIM_TICK_HZ + 1):
            room.advance(DT)
            room.apply_input(
                alice, InputFrame(seq=seq, dt=9_999.0, forward=True, yaw=0.0)
            )
        assert abs(room.players[alice].position.z - start.z) == pytest.approx(
            MOVE_SPEED
        )

    @pytest_intent.intent("INT-007")
    def test_a_player_cannot_leave_the_arena(self) -> None:
        room, alice, _ = _started_room("T05")
        _walk(room, alice, seconds=30.0)
        position = room.players[alice].position
        assert room.arena.bounds_min.x <= position.x <= room.arena.bounds_max.x
        assert room.arena.bounds_min.z <= position.z <= room.arena.bounds_max.z

    @pytest_intent.intent("INT-009")
    def test_input_is_a_noop_outside_the_playing_state(self) -> None:
        room = MatchRoom.new(room_id="T06")
        alice = room.add_player("alice")
        before = alice.position
        room.advance(DT)
        room.apply_input(alice.id, InputFrame(seq=1, dt=DT, forward=True, yaw=0.0))
        assert room.players[alice.id].position == before

    @pytest_intent.intent("INT-009")
    def test_no_client_message_carries_a_position(self) -> None:
        """`input` is the only path to a position, and it has no field for one.

        The frame parser is the enforcement point: a message may claim a
        position, a velocity or a displacement, and none of those words
        survive `InputFrame.from_wire`.
        """
        service, repo = _build_service()
        room, alice, _ = _started_room("T07")
        repo.save(room)
        before = room.players[alice].position

        for forged in (
            {"type": "input", "position": [100.0, 0.0, 100.0], "seq": 1, "dt": DT},
            {"type": "input", "velocity": [100.0, 0.0, 100.0], "seq": 2, "dt": DT},
            {"type": "input", "move": [100.0, 0.0, 100.0], "seq": 3, "dt": DT},
            {"type": "teleport", "x": 100.0, "y": 0.0, "z": 100.0},
            {"type": "position_set", "position": [100.0, 0.0, 100.0]},
        ):
            asyncio.run(service.handle_message("T07", alice, forged))

        assert room.players[alice].position == before

    @pytest_intent.intent("INT-004")
    def test_a_client_cannot_name_its_own_victim(self) -> None:
        """Damage follows a ray the server casts, never a declared target."""
        service, repo = _build_service()
        room, alice, bob = _started_room("T08")
        repo.save(room)
        room.players[alice].position = Vec3(20.0, 0.0, 10.0)
        room.players[bob].position = Vec3(20.0, 0.0, 0.0)

        asyncio.run(
            service.handle_message(
                "T08",
                alice,
                {
                    "type": "input",
                    "seq": 1,
                    "dt": DT,
                    "buttons": {"fire": True},
                    "yaw": math.pi,  # facing away from bob
                    "pitch": 0.0,
                    "target": bob,
                    "damage": 999,
                },
            )
        )
        assert room.players[bob].health.current == room.players[bob].health.max


class TestTick:
    @pytest_intent.intent("INT-009")
    def test_the_tick_advances_the_respawn_timer(self) -> None:
        room, alice, _ = _started_room("T09")
        room.players[alice].health.damage(100)
        before = room.players[alice].health.respawn_remaining
        room.advance(DT)
        assert room.players[alice].health.respawn_remaining < before

    @pytest_intent.intent("INT-005")
    def test_respawn_places_the_player_on_a_spawn_point(self) -> None:
        """Dying where you stood and reviving there feeds spawn camping."""
        room, alice, _ = _started_room("T10")
        room.players[alice].position = Vec3(3.0, 0.0, 3.0)
        room.players[alice].health.damage(100)
        died_at = room.players[alice].position

        for _ in range(int(4.0 * SIM_TICK_HZ)):
            room.advance(DT)

        revived_at = room.players[alice].position
        assert room.players[alice].health.is_alive
        assert revived_at != died_at
        assert revived_at in room.arena.spawn_points
