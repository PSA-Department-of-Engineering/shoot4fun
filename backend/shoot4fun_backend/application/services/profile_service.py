"""The profile application service.

Owns the user/profile use cases every inbound adapter calls: create,
fetch, and patch a profile. Creation is unique on the username and
raises `UsernameTakenError`; the preferences default to the client's
own constants so a profile created without them is identical to a
player who never touched the settings dialog.
"""
from __future__ import annotations

from dataclasses import dataclass

from shoot4fun_backend.application.ports.outbound.user_repository import UserRepository
from shoot4fun_backend.domain.exceptions.username_taken_error import UsernameTakenError
from shoot4fun_backend.domain.model.user_profile import UserProfile
from shoot4fun_backend.logging import get_logger

__all__ = ["ProfileService"]

_log = get_logger("profile_service")

# The client's defaults (`settings.state.ts`), mirrored so a profile
# created without preferences holds the values a fresh player would have.
DEFAULT_SENSITIVITY = 0.0022
DEFAULT_MASTER_VOLUME = 0.7
DEFAULT_SFX_VOLUME = 0.8


@dataclass
class ProfileService:
    users: UserRepository

    async def create_profile(
        self,
        username: str,
        display_name: str | None = None,
        sensitivity: float | None = None,
        master_volume: float | None = None,
        sfx_volume: float | None = None,
    ) -> UserProfile:
        if not display_name:
            display_name = username
        try:
            return await self.users.create(
                username=username,
                display_name=display_name,
                sensitivity=(
                    sensitivity if sensitivity is not None else DEFAULT_SENSITIVITY
                ),
                master_volume=(
                    master_volume if master_volume is not None else DEFAULT_MASTER_VOLUME
                ),
                sfx_volume=sfx_volume if sfx_volume is not None else DEFAULT_SFX_VOLUME,
            )
        except UsernameTakenError:
            _log.info("create_profile username taken: %s", username)
            raise

    async def get_profile(self, username: str) -> UserProfile | None:
        return await self.users.get_by_username(username)

    async def update_profile(
        self,
        username: str,
        *,
        display_name: str | None = None,
        sensitivity: float | None = None,
        master_volume: float | None = None,
        sfx_volume: float | None = None,
    ) -> UserProfile | None:
        return await self.users.update_profile(
            username,
            display_name=display_name,
            sensitivity=sensitivity,
            master_volume=master_volume,
            sfx_volume=sfx_volume,
        )
