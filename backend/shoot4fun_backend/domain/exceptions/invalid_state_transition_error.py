"""Invalid match-state transition."""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["InvalidStateTransitionError"]


class InvalidStateTransitionError(AppError):
    def __init__(self, current: str, target: str) -> None:
        self.current = current
        self.target = target
        super().__init__(f"invalid match-state transition: {current} -> {target}")
