"""The entry path could not mint a guest account: every name attempt
failed at the store. A service condition, not a caller mistake."""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["GuestMintError"]


class GuestMintError(AppError):
    """Guest creation failed after every display-name attempt."""

    def __init__(self) -> None:
        super().__init__("could not create an account right now, try again shortly")
