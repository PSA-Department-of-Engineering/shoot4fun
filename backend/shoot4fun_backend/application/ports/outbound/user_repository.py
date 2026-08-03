"""Outbound port: profile storage (issue #12).

The contract is a per-username store of the profile shape: display name
and the three preferences that otherwise live only in `localStorage`.
Creation is unique on the username; an update is a partial patch of the
profile fields and answers the updated profile, or `None` when the
username does not exist.

The MVP implementation is in-memory; the production implementation is
asyncpg against the platform-minted `pg-app-shoot4fun` role, sharing the
database with the leaderboard (`INT-017`).
"""
from __future__ import annotations

from typing import Protocol

from shoot4fun_backend.domain.model.user_profile import UserProfile

__all__ = ["UserRepository"]


class UserRepository(Protocol):
    async def create(
        self,
        username: str,
        display_name: str,
        sensitivity: float,
        master_volume: float,
        sfx_volume: float,
    ) -> UserProfile: ...
    async def get_by_username(self, username: str) -> UserProfile | None: ...
    async def update_profile(
        self,
        username: str,
        *,
        display_name: str | None = None,
        sensitivity: float | None = None,
        master_volume: float | None = None,
        sfx_volume: float | None = None,
    ) -> UserProfile | None: ...
