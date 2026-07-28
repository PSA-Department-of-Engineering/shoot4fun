"""Per-player kill counter.

A counter per (room, player_id). `record_kill` is the only mutator; the
winner is the player with the highest count when the match ends. Ties
break on first-seen order (so the result is deterministic and stable).
"""
from __future__ import annotations

from dataclasses import dataclass, field

__all__ = ["KillCounter"]


@dataclass
class KillCounter:
    _kills: dict[str, int] = field(default_factory=dict)
    _order: list[str] = field(default_factory=list)

    def record_kill(self, killer_id: str) -> None:
        if killer_id not in self._kills:
            self._kills[killer_id] = 0
            self._order.append(killer_id)
        self._kills[killer_id] += 1

    def get_kills(self, player_id: str) -> int:
        return self._kills.get(player_id, 0)

    @property
    def totals(self) -> dict[str, int]:
        return dict(self._kills)

    def winner(self) -> str | None:
        if not self._kills:
            return None
        best_score = max(self._kills.values())
        for pid in self._order:
            if self._kills[pid] == best_score:
                return pid
        return None
