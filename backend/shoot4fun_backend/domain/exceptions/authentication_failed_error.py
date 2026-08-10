"""A credential that did not resolve to an account.

One error for every failure on the way in: an unknown display name, a wrong
recovery code, an expired session. Distinguishing them in the response tells a
caller which half of a guess was right.
"""
from __future__ import annotations

from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["AuthenticationFailedError"]


class AuthenticationFailedError(AppError):
    def __init__(self) -> None:
        super().__init__("display name or recovery code is incorrect")
