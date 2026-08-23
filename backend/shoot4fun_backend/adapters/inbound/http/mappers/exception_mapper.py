"""Mapping from domain exceptions to HTTP status codes."""

from __future__ import annotations

from shoot4fun_backend.domain.exceptions.entity_not_found_error import EntityNotFoundError
from shoot4fun_backend.domain.exceptions.guest_mint_error import GuestMintError

__all__ = ["STATUS_MAP", "DEFAULT_STATUS"]

STATUS_MAP: dict[type[Exception], int] = {
    EntityNotFoundError: 404,
    # The entry path is a service condition, not a client mistake.
    GuestMintError: 503,
}
DEFAULT_STATUS = 500
