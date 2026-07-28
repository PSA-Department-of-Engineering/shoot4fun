"""Match room is full."""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["RoomFullError"]


class RoomFullError(AppError):
    def __init__(self, room_id: str, capacity: int) -> None:
        self.room_id = room_id
        self.capacity = capacity
        super().__init__(f"room {room_id!r} is full (capacity {capacity})")
