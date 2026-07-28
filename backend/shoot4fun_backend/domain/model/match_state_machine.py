"""The match state machine.

The transition table is the contract. A `playing -> playing` direct
re-entry is not allowed; the only way to "restart" is `results -> lobby`
then `lobby -> playing` (or `lobby -> lobby` for a non-starting ready
toggle). Any other transition raises `InvalidStateTransitionError`.

The HP-only-changes-in-playing invariant is enforced *at the use case
layer* via `MatchService.apply_input` checking the room's state before
forwarding to `Player.damage`; the state machine itself is the
declarative table.
"""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.invalid_state_transition_error import (
    InvalidStateTransitionError,
)
from shoot4fun_backend.domain.model.match_state import MatchState

__all__ = ["MatchStateMachine", "ALLOWED_TRANSITIONS"]


ALLOWED_TRANSITIONS: dict[MatchState, frozenset[MatchState]] = {
    MatchState.LOBBY: frozenset({MatchState.LOBBY, MatchState.PLAYING}),
    MatchState.PLAYING: frozenset({MatchState.PLAYING, MatchState.RESULTS}),
    MatchState.RESULTS: frozenset({MatchState.RESULTS, MatchState.LOBBY}),
}


class MatchStateMachine:
    @staticmethod
    def can_transition(current: MatchState, target: MatchState) -> bool:
        return target in ALLOWED_TRANSITIONS.get(current, frozenset())

    @staticmethod
    def assert_transition(current: MatchState, target: MatchState) -> None:
        if not MatchStateMachine.can_transition(current, target):
            raise InvalidStateTransitionError(current.value, target.value)
