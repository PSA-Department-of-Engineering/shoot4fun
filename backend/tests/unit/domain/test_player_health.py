"""Unit tests for PlayerHealth (`INT-005`).

The two contracts:

* `damage(n)` clamps HP at 0; the floor is non-negative.
* `respawn()` always lands at `max`.

Plus the respawn countdown via `advance(dt)`: when the timer reaches 0
the player auto-respawns and HP is full.
"""
from __future__ import annotations

import pytest
from pytest_intent import intent

from shoot4fun_backend.domain.model.player_health import RESPAWN_SECONDS, PlayerHealth


class TestPlayerHealth:
    @intent("INT-005")
    def test_hp_is_non_negative_after_damage(self) -> None:
        hp = PlayerHealth(max=100)
        hp.damage(150)
        assert hp.current == 0
        assert hp.is_alive is False

    @intent("INT-005")
    def test_hp_clamps_at_zero_on_overkill(self) -> None:
        hp = PlayerHealth(max=50)
        for _ in range(5):
            hp.damage(40)
        assert hp.current == 0

    @intent("INT-005")
    def test_respawn_resets_hp_to_full(self) -> None:
        hp = PlayerHealth(max=100)
        hp.damage(100)
        assert hp.is_alive is False
        hp.respawn()
        assert hp.is_alive is True
        assert hp.current == hp.max == 100

    @intent("INT-005")
    def test_respawn_timer_starts_at_three_seconds(self) -> None:
        hp = PlayerHealth(max=100)
        hp.damage(100)
        assert hp.respawn_remaining == pytest.approx(RESPAWN_SECONDS)

    @intent("INT-005")
    def test_respawn_after_three_seconds_of_advancing(self) -> None:
        hp = PlayerHealth(max=100)
        hp.damage(100)
        assert hp.is_alive is False
        hp.advance(1.5)
        assert hp.is_alive is False
        hp.advance(1.5)
        assert hp.is_alive is True
        assert hp.current == hp.max

    @intent("INT-005")
    def test_damage_on_dead_player_is_a_noop(self) -> None:
        hp = PlayerHealth(max=100)
        hp.damage(100)
        hp.damage(50)
        assert hp.current == 0

    @intent("INT-005")
    def test_advance_on_alive_player_is_a_noop(self) -> None:
        hp = PlayerHealth(max=100)
        hp.advance(10.0)
        assert hp.current == 100
        assert hp.is_alive is True
