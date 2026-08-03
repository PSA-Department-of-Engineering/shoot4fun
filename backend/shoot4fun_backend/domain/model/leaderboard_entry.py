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
    # The profile the score is attributable to once login lands (issue
    # #12); `None` for a guest score, which is name-only.
    user_id: str | None = None
