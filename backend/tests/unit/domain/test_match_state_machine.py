"""Unit tests for MatchStateMachine (`INT-011`).

The HP-only-changes-in-playing invariant is enforced at the use case
layer; this test asserts the *declarative* state table and the FSM
methods on `MatchRoom` that gate the transitions.
"""
from __future__ import annotations

import pytest
import pytest_intent

from shoot4fun_backend.domain.exceptions.invalid_state_transition_error import (
    InvalidStateTransitionError,
)
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.match_room import ROOM_CAPACITY, MatchRoom
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.match_state_machine import (
    ALLOWED_TRANSITIONS,
    MatchStateMachine,
)


class TestMatchStateMachine:
    @pytest_intent.intent("INT-011")
    def test_lobby_allows_start_only_when_all_ready(self) -> None:
        room = MatchRoom.new()
        p1 = room.add_player("alice")
        p2 = room.add_player("bob")
        room.set_ready(p1.id, True)
        room.start()
        assert room.state is MatchState.LOBBY
        room.set_ready(p2.id, True)
        room.start()
        assert room.state is MatchState.PLAYING

    @pytest_intent.intent("INT-011")
    def test_lobby_is_only_state_where_ready_up_accepted(self) -> None:
        room = MatchRoom.new()
        p1 = room.add_player("alice")
        p2 = room.add_player("bob")
        room.set_ready(p1.id, True)
        room.set_ready(p2.id, True)
        room.start()
        assert room.state is MatchState.PLAYING
        room.set_ready(p1.id, True)
        assert room.players[p1.id].is_ready is False
        assert room.state is MatchState.PLAYING

    @pytest_intent.intent("INT-011")
    def test_playing_to_results_then_lobby(self) -> None:
        room = MatchRoom.new()
        for name in ("a", "b", "c", "d"):
            room.add_player(name)
        for p in room.players.values():
            room.set_ready(p.id, True)
        room.start()
        assert room.state is MatchState.PLAYING
        room.end()
        assert room.state is MatchState.RESULTS
        room.reset()
        assert room.state is MatchState.LOBBY

    @pytest_intent.intent("INT-011")
    def test_invalid_transition_raises(self) -> None:
        with pytest.raises(InvalidStateTransitionError):
            MatchStateMachine.assert_transition(MatchState.LOBBY, MatchState.RESULTS)

    @pytest_intent.intent("INT-011")
    def test_apply_input_is_noop_outside_playing(self) -> None:
        room = MatchRoom.new()
        p = room.add_player("alice")
        before = p.position
        room.advance(1.0 / 60.0)
        room.apply_input(p.id, InputFrame(seq=1, dt=1.0 / 60.0, forward=True))
        assert p.position == before

    @pytest_intent.intent("INT-011")
    def test_hp_only_changes_during_playing_state(self) -> None:
        room = MatchRoom.new()
        p = room.add_player("alice")
        room.add_player("bob")
        before = p.health.current
        room.record_kill("nobody")
        room.record_death(p.id)
        assert p.health.current == before
        assert p.deaths == 0

    @pytest_intent.intent("INT-011")
    def test_transition_table(self) -> None:
        assert MatchState.PLAYING in ALLOWED_TRANSITIONS[MatchState.LOBBY]
        assert MatchState.RESULTS in ALLOWED_TRANSITIONS[MatchState.PLAYING]
        assert MatchState.LOBBY in ALLOWED_TRANSITIONS[MatchState.RESULTS]
        assert MatchState.PLAYING not in ALLOWED_TRANSITIONS[MatchState.RESULTS]

    @pytest_intent.intent("INT-011")
    def test_room_capacity_is_four(self) -> None:
        assert ROOM_CAPACITY == 4
