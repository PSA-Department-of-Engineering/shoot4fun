"""Cross-cutting domain constants.

Values more than one aggregate needs, so neither has to import the
other to agree on them. The simulation rules that only `movement`
owns (speed, frame budget) live with the routine that applies them.
"""
from __future__ import annotations

__all__ = [
    "MAX_PLAYER_HP",
    "PLAYER_EYE_HEIGHT",
    "PLAYER_HEIGHT",
    "PLAYER_RADIUS",
]


PLAYER_RADIUS: float = 0.45
"""Horizontal half-width of a player, for collision and hit tests."""

PLAYER_HEIGHT: float = 1.8
"""Full standing height; the capsule spans the ground to here."""

PLAYER_EYE_HEIGHT: float = 1.6
"""Camera and shot origin above the player's feet (`ADR-0002`)."""

MAX_PLAYER_HP: int = 100
