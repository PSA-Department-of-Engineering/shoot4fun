"""A display name another account already holds."""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["DisplayNameTakenError"]


class DisplayNameTakenError(AppError):
    def __init__(self, display_name: str) -> None:
        self.display_name = display_name
        super().__init__(f"display name {display_name!r} is already taken")
