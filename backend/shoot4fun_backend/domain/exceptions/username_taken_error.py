"""The username is already claimed by another profile."""

from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["UsernameTakenError"]


class UsernameTakenError(AppError):
    """A second creation of an existing username was refused."""

    def __init__(self, username: str) -> None:
        self.username = username
        super().__init__(f"username already taken: {username}")
