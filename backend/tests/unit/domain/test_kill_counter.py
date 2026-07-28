"""Unit tests for KillCounter (`INT-010`).

The contract: `record_kill` increments the killer's count and leaves
everyone else's count alone. The `winner` is the player with the
highest count, ties broken by insertion order.
"""
from __future__ import annotations

import pytest_intent

from shoot4fun_backend.domain.model.kill_counter import KillCounter


class TestKillCounter:
    @pytest_intent.intent("INT-010")
    def test_kill_counter_increments_on_confirmed_kill(self) -> None:
        kc = KillCounter()
        kc.record_kill("p1")
        kc.record_kill("p1")
        kc.record_kill("p2")
        assert kc.get_kills("p1") == 2
        assert kc.get_kills("p2") == 1

    @pytest_intent.intent("INT-010")
    def test_unknown_player_starts_at_zero(self) -> None:
        kc = KillCounter()
        assert kc.get_kills("nobody") == 0

    @pytest_intent.intent("INT-010")
    def test_winner_is_highest_count(self) -> None:
        kc = KillCounter()
        kc.record_kill("p1")
        kc.record_kill("p2")
        kc.record_kill("p2")
        kc.record_kill("p2")
        assert kc.winner() == "p2"

    @pytest_intent.intent("INT-010")
    def test_winner_tie_breaks_on_first_seen(self) -> None:
        kc = KillCounter()
        kc.record_kill("p1")
        kc.record_kill("p2")
        assert kc.winner() == "p1"

    @pytest_intent.intent("INT-010")
    def test_empty_counter_has_no_winner(self) -> None:
        kc = KillCounter()
        assert kc.winner() is None
