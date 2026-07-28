"""Match lifecycle states.

The single source of truth for the state machine in `match_state_machine.py`.
The `playing` state is the only state in which HP and the kill counter change;
the `lobby` state is the only state where ready-up is accepted; the `results`
state is the only state where the leaderboard renders.
"""
from __future__ import annotations

from enum import Enum

__all__ = ["MatchState"]


class MatchState(str, Enum):
    LOBBY = "lobby"
    PLAYING = "playing"
    RESULTS = "results"
