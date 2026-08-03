"""Mapping from domain exceptions to HTTP status codes."""

from __future__ import annotations

from shoot4fun_backend.domain.exceptions.entity_not_found_error import EntityNotFoundError
from shoot4fun_backend.domain.exceptions.username_taken_error import UsernameTakenError

__all__ = ["STATUS_MAP", "DEFAULT_STATUS"]

STATUS_MAP: dict[type[Exception], int] = {
    EntityNotFoundError: 404,
    UsernameTakenError: 409,
}
DEFAULT_STATUS = 500
