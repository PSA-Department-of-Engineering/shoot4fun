"""Request and response DTOs for the account surface.

No response type carries the recovery code or a session token except the two
that mint one, and none ever carries a digest: the stored hash is no more
returnable than the secret it stands for.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

__all__ = [
    "AccountView",
    "ProfileView",
    "RegisterRequest",
    "RotateRequest",
    "SessionView",
    "SignInRequest",
]


class AccountView(BaseModel):
    """An account as any authenticated read returns it."""

    user_id: str
    display_name: str
    registered: bool


class SessionView(AccountView):
    """An account plus the session just minted for it."""

    token: str


class MintedView(SessionView):
    """An account, its session, and a recovery code shown exactly once."""

    recovery_code: str


class RegisterRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=24)


class SignInRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=64)
    recovery_code: str = Field(..., min_length=1, max_length=128)


class RotateRequest(BaseModel):
    current_code: str = Field(..., min_length=1, max_length=128)


class ProfileView(BaseModel):
    sensitivity: float
    touch_sensitivity: float
    master_volume: float
    sfx_volume: float
    haptics_enabled: bool
