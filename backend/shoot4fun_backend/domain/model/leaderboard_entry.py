"""Per-arena best score."""
from __future__ import annotations

from dataclasses import dataclass

__all__ = ["LeaderboardEntry"]


@dataclass(frozen=True, slots=True)
class LeaderboardEntry:
    arena: str
    best_score: int
    holder_name: str
    updated_at: str
