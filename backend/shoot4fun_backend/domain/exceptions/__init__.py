"""Domain exceptions barrel."""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError
from shoot4fun_backend.domain.exceptions.authentication_failed_error import (
    AuthenticationFailedError,
)
from shoot4fun_backend.domain.exceptions.display_name_taken_error import (
    DisplayNameTakenError,
)
from shoot4fun_backend.domain.exceptions.entity_not_found_error import EntityNotFoundError
from shoot4fun_backend.domain.exceptions.invalid_state_transition_error import (
    InvalidStateTransitionError,
)
from shoot4fun_backend.domain.exceptions.room_full_error import RoomFullError

__all__ = [
    "AppError",
    "AuthenticationFailedError",
    "DisplayNameTakenError",
    "EntityNotFoundError",
    "InvalidStateTransitionError",
    "RoomFullError",
]
