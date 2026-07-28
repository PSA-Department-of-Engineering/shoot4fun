"""Mapping from domain exceptions to HTTP status codes."""

from __future__ import annotations

from shoot4fun_backend.domain.exceptions.entity_not_found_error import EntityNotFoundError

__all__ = ["STATUS_MAP", "DEFAULT_STATUS"]

STATUS_MAP: dict[type[Exception], int] = {
    EntityNotFoundError: 404,
}
DEFAULT_STATUS = 500
