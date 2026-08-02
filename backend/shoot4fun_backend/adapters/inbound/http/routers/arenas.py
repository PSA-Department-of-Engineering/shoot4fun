"""Arena routes: the catalogue the lobby's map picker is built from.

The server owns which arenas exist, because it owns the layouts and
refuses a `select_map` naming anything else. Offering that set over HTTP
is what keeps the picker from being a second, hand-maintained list of
the same names on the client.
"""

from __future__ import annotations

from fastapi import APIRouter

from shoot4fun_backend.adapters.inbound.http.dtos.arena_summary import ArenaSummary
from shoot4fun_backend.domain.model.arena import DEFAULT_ARENAS

__all__ = ["router"]

router = APIRouter()


@router.get("/arenas", response_model=list[ArenaSummary])
async def list_arenas() -> list[ArenaSummary]:
    """Every arena a room can be set to, in the order they are offered."""
    return [
        ArenaSummary(**arena.to_catalogue_entry()) for arena in DEFAULT_ARENAS.values()
    ]
