"""Response DTO for the arena catalogue."""

from __future__ import annotations

from pydantic import BaseModel

__all__ = ["ArenaSummary"]


class ArenaSummary(BaseModel):
    """One arena as the lobby's map picker offers it."""

    id: str
    name: str
    blurb: str
