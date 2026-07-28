"""Hit-point invariant + respawn timer.

The two contracts:

* HP is non-negative: `damage(n)` clamps at 0.
* Respawn resets HP to `max`: a fresh `respawn()` always lands at `max`.

The respawn timer (`respawn_remaining`) counts down in seconds while the
player is dead; the authoritative tick advances it. When it reaches 0,
the player auto-respawns (INT-005).
"""
from __future__ import annotations

from dataclasses import dataclass, field

__all__ = ["PlayerHealth", "RESPAWN_SECONDS"]


RESPAWN_SECONDS: float = 3.0


@dataclass(slots=True)
class PlayerHealth:
    max: int
    current: int = field(init=False)
    respawn_remaining: float = field(default=0.0, init=False)
    is_alive: bool = field(default=True, init=False)

    def __post_init__(self) -> None:
        if self.max <= 0:
            raise ValueError(f"max_hp must be positive, got {self.max}")
        self.current = self.max

    def damage(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError(f"damage must be positive, got {amount}")
        if not self.is_alive:
            return
        self.current = max(0, self.current - amount)
        if self.current == 0:
            self.is_alive = False
            self.respawn_remaining = RESPAWN_SECONDS

    def advance(self, dt: float) -> None:
        if self.is_alive:
            return
        self.respawn_remaining = max(0.0, self.respawn_remaining - dt)
        if self.respawn_remaining == 0.0:
            self.respawn()

    def respawn(self) -> None:
        self.current = self.max
        self.is_alive = True
        self.respawn_remaining = 0.0
