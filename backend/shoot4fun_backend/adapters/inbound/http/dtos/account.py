"""Request and response DTOs for the account surface.

No response type carries a password digest, and none ever carries a session
token except the one that mints it: the stored hash is no more returnable than
the secret it stands for.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "AccountView",
    "ArsenalView",
    "ArsenalPutRequest",
    "ChangePasswordRequest",
    "CreateAccountRequest",
    "ProfileView",
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


class CreateAccountRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=24)
    password: str = Field(..., min_length=8, max_length=128)


class SignInRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class ProfileView(BaseModel):
    sensitivity: float
    touch_sensitivity: float
    master_volume: float
    sfx_volume: float
    haptics_enabled: bool


class ArsenalView(BaseModel):
    """A player's arsenal, including any field a future build added.

    `extra="allow"` keeps unknown keys (weapon unlocks, outfits, stats) so
    the envelope round-trips without loss: a client that does not yet know a
    field must not strip it (ARS-004, INT-029)."""

    model_config = ConfigDict(extra="allow")

    version: int = 1
    model: str | None = None
    loadout: dict[str, Any] = Field(default_factory=dict)


class ArsenalPutRequest(BaseModel):
    """The same envelope on the way in. Accepts the known keys plus any
    forward-shaped field; the service stores it verbatim (ADR-0007)."""

    model_config = ConfigDict(extra="allow")

    version: int = 1
    model: str | None = None
    loadout: dict[str, Any] = Field(default_factory=dict)
