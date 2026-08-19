"""Request and response DTOs for the account surface.

No response type carries the recovery code or a session token except the two
that mint one, and none ever carries a digest: the stored hash is no more
returnable than the secret it stands for.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "AccountView",
    "ArsenalView",
    "ArsenalPutRequest",
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
