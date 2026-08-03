"""In-memory `UserRepository`.

The MVP implementation; the production implementation lives in
`postgres_user_repository.py` and is selected by the container when the
`pg-app-shoot4fun` connection string is set.
"""
from __future__ import annotations

import datetime as _dt
import uuid

from shoot4fun_backend.application.ports.outbound.user_repository import UserRepository
from shoot4fun_backend.domain.exceptions.username_taken_error import UsernameTakenError
from shoot4fun_backend.domain.model.user_profile import UserProfile

__all__ = ["InMemoryUserRepository"]


class InMemoryUserRepository(UserRepository):
    def __init__(self) -> None:
        self._profiles: dict[str, UserProfile] = {}

    async def create(
        self,
        username: str,
        display_name: str,
        sensitivity: float,
        master_volume: float,
        sfx_volume: float,
    ) -> UserProfile:
        if username in self._profiles:
            raise UsernameTakenError(username)
        profile = UserProfile(
            id=str(uuid.uuid4()),
            username=username,
            display_name=display_name,
            sensitivity=sensitivity,
            master_volume=master_volume,
            sfx_volume=sfx_volume,
            created_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        )
        self._profiles[username] = profile
        return profile

    async def get_by_username(self, username: str) -> UserProfile | None:
        return self._profiles.get(username)

    async def update_profile(
        self,
        username: str,
        *,
        display_name: str | None = None,
        sensitivity: float | None = None,
        master_volume: float | None = None,
        sfx_volume: float | None = None,
    ) -> UserProfile | None:
        current = self._profiles.get(username)
        if current is None:
            return None
        updated = UserProfile(
            id=current.id,
            username=current.username,
            display_name=display_name if display_name is not None else current.display_name,
            sensitivity=sensitivity if sensitivity is not None else current.sensitivity,
            master_volume=(
                master_volume if master_volume is not None else current.master_volume
            ),
            sfx_volume=sfx_volume if sfx_volume is not None else current.sfx_volume,
            created_at=current.created_at,
        )
        self._profiles[username] = updated
        return updated
