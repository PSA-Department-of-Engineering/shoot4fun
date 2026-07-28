"""In-memory `RoomRepository`.

The MVP ships rooms in process; a future Postgres implementation would
back this with a SQL store and the same protocol. The repository is
thread-safe enough for asyncio (no locks needed at the storage layer
because the application service takes the room-level `asyncio.Lock`
before mutating); a multi-process deployment would need a real lock.
"""
from __future__ import annotations

from shoot4fun_backend.application.ports.outbound.room_repository import RoomRepository
from shoot4fun_backend.domain.model.match_room import MatchRoom

__all__ = ["InMemoryRoomRepository"]


class InMemoryRoomRepository(RoomRepository):
    def __init__(self) -> None:
        self._rooms: dict[str, MatchRoom] = {}

    def get(self, room_id: str) -> MatchRoom | None:
        return self._rooms.get(room_id)

    def save(self, room: MatchRoom) -> None:
        self._rooms[room.id] = room

    def delete(self, room_id: str) -> None:
        self._rooms.pop(room_id, None)

    def list_all(self) -> list[MatchRoom]:
        return list(self._rooms.values())
