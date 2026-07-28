"""Outbound port: room storage.

The `RoomRepository` is the durable handle on rooms. The MVP ships an
in-memory implementation; a future Postgres implementation would back
this with a SQL store and the same protocol.
"""
from __future__ import annotations

from typing import Protocol

from shoot4fun_backend.domain.model.match_room import MatchRoom

__all__ = ["RoomRepository"]


class RoomRepository(Protocol):
    def get(self, room_id: str) -> MatchRoom | None: ...
    def save(self, room: MatchRoom) -> None: ...
    def delete(self, room_id: str) -> None: ...
    def list_all(self) -> list[MatchRoom]: ...
