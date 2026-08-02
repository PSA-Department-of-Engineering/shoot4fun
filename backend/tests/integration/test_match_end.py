"""What ends a match, and what does not (`INT-010`), per `ADR-0005`.

The contradiction these exist to hold shut: a match that ends the
instant someone dies makes respawn unreachable in a two-player room,
which is the commonest room there is. `INT-005` promises a dead player
comes back after three seconds; this module proves the match is still
running when they do.

Death is a transition, not an exit. The two things that do end a match
are the clock and the room emptying, and both are the tick's to spot.
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
from shoot4fun_backend.domain.model.match_room import SIM_TICK_HZ, MatchRoom
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.player_health import RESPAWN_SECONDS

DT = 1.0 / SIM_TICK_HZ


def _service(repo: InMemoryRoomRepository) -> MatchService:
    return MatchService(
        rooms=repo,
        broadcaster=WebSocketBroadcaster(),
        leaderboard=InMemoryLeaderboardRepository(),
    )


def _duel(room_id: str) -> tuple[MatchService, MatchRoom, str, str]:
    """The smallest match there is: two players, readied, playing."""
    repo = InMemoryRoomRepository()
    room = MatchRoom.new(room_id=room_id)
    repo.save(room)
    alice = room.add_player("alice")
    bob = room.add_player("bob")
    for player in room.players.values():
        room.set_ready(player.id, True)
    room.start()
    return _service(repo), room, alice.id, bob.id


def _advance(service: MatchService, room: MatchRoom, seconds: float) -> None:
    """Pass `seconds` of simulated time, then let the service settle.

    The service's tick derives its delta from the wall clock, so looping
    over `tick_all` advances the world by however long the loop itself
    took, not by the time the test means. Simulated time is the room's
    to advance; the service's job here is only to evaluate whether the
    match should end.
    """
    for _ in range(int(seconds * SIM_TICK_HZ)):
        room.advance(DT)
    asyncio.run(service.tick_all())


class TestAKillDoesNotEndTheMatch:
    @pytest_intent.intent("INT-010")
    def test_the_match_runs_on_after_a_kill_in_a_duel(self) -> None:
        service, room, _, bob = _duel("M01")
        room.players[bob].health.damage(100)

        asyncio.run(service.tick_all())

        assert room.state is MatchState.PLAYING

    @pytest_intent.intent("INT-005")
    def test_the_victim_of_a_duel_kill_lives_to_respawn(self) -> None:
        """The whole point of the respawn loop, in the room where it was
        previously unreachable."""
        service, room, _, bob = _duel("M02")
        room.players[bob].health.damage(100)
        assert not room.players[bob].health.is_alive

        _advance(service, room, RESPAWN_SECONDS + 0.5)

        assert room.state is MatchState.PLAYING
        assert room.players[bob].health.is_alive
        assert room.players[bob].health.current == room.players[bob].health.max
        assert room.players[bob].position in room.arena.spawn_points

    @pytest_intent.intent("INT-010")
    def test_a_kill_still_scores_while_the_match_runs_on(self) -> None:
        service, room, alice, bob = _duel("M03")
        room.record_kill(alice)
        room.record_death(bob)

        asyncio.run(service.tick_all())

        assert room.state is MatchState.PLAYING
        assert room.players[alice].kills == 1
        assert room.kills.winner() == alice


class TestWhatDoesEndTheMatch:
    @pytest_intent.intent("INT-010")
    def test_the_match_ends_when_the_room_drops_below_two_players(self) -> None:
        service, room, _, bob = _duel("M04")

        asyncio.run(service.disconnect("M04", bob))
        asyncio.run(service.tick_all())

        assert room.state is MatchState.RESULTS

    @pytest_intent.intent("INT-010")
    def test_the_match_ends_when_the_clock_runs_out(self) -> None:
        service, room, _, _ = _duel("M05")
        # Bring the deadline forward rather than waiting out the match.
        room.ends_at = 0.0

        asyncio.run(service.tick_all())

        assert room.state is MatchState.RESULTS

    @pytest_intent.intent("INT-010")
    def test_a_lone_player_does_not_keep_playing_against_nobody(self) -> None:
        """A player left alone previously kept running: the end condition
        required two or more players before it would consider ending."""
        service, room, alice, bob = _duel("M06")
        asyncio.run(service.disconnect("M06", bob))

        _advance(service, room, 0.5)

        assert room.state is MatchState.RESULTS
        assert list(room.players) == [alice]
