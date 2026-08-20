"""Outbound port: account, session and profile storage.

Three tables behind one port because they share a lifetime: deleting an account
takes its sessions and its profile with it, and no caller ever wants one without
the others.

Only digests cross this port. The service hashes before it calls, so an
implementation never sees a usable credential and a leaked store is not a set of
bearer tokens.
"""
from __future__ import annotations

from typing import Protocol

from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.arsenal import PlayerArsenal
from shoot4fun_backend.domain.model.player_profile import PlayerProfile

__all__ = ["AccountRepository"]


class AccountRepository(Protocol):
    async def create_guest(
        self, user_id: str, display_name: str
    ) -> Account | None:
        """None when the display name is already held. The uniqueness check IS
        the insert: asking first and inserting second leaves a window where two
        callers both see the name free and the loser's insert raises."""
        ...

    async def get(self, user_id: str) -> Account | None: ...

    async def find_by_display_name(self, display_name: str) -> Account | None: ...

    async def find_by_external(self, issuer: str, subject: str) -> Account | None: ...

    async def register(
        self, user_id: str, display_name: str, recovery_hash: str
    ) -> Account: ...

    async def rename(self, user_id: str, display_name: str) -> Account: ...

    async def recovery_hash_for(self, user_id: str) -> str | None: ...

    async def set_recovery_hash(self, user_id: str, recovery_hash: str) -> None: ...

    async def create_session(
        self, token_hash: str, user_id: str, ttl_ms: int
    ) -> None: ...

    async def user_id_for_session(self, token_hash: str) -> str | None: ...

    async def delete_session(self, token_hash: str) -> None: ...

    async def delete_sessions_for_user(self, user_id: str) -> None: ...

    async def sweep(self, grace_ms: int) -> int:
        """Drop expired sessions and every guest they leave unreachable;
        answers with how many accounts went."""
        ...

    async def get_profile(self, user_id: str) -> PlayerProfile | None: ...

    async def save_profile(self, user_id: str, profile: PlayerProfile) -> None: ...

    async def get_arsenal(self, user_id: str) -> dict | None:
        """The player's Arsenal envelope as stored, or None when nothing has
        been written yet. The value is an opaque dict; the service validates it
        through the domain model, so a caller never sees an ill-formed payload."""

    async def save_arsenal(self, user_id: str, envelope: dict) -> None:
        """Persist the Arsenal envelope for a player. Unknown fields inside the
        envelope's data object are kept, so a future shape grows without loss."""
