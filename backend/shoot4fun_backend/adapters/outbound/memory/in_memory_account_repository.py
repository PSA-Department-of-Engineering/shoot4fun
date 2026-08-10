"""In-memory `AccountRepository`.

The development and test backend, mirroring the Postgres adapter's semantics so
a test exercises the same service logic the deployment runs. Nothing here
survives a restart, which is exactly what a missing `DATABASE_URL` means.
"""
from __future__ import annotations

from datetime import datetime, timezone

from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.player_profile import PlayerProfile

__all__ = ["InMemoryAccountRepository"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InMemoryAccountRepository(AccountRepository):
    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}
        self._recovery: dict[str, str] = {}
        self._sessions: dict[str, str] = {}
        self._profiles: dict[str, PlayerProfile] = {}

    async def create_guest(self, user_id: str, display_name: str) -> Account:
        account = Account(
            user_id=user_id,
            display_name=display_name,
            registered=False,
            created_at=_now(),
        )
        self._accounts[user_id] = account
        return account

    async def get(self, user_id: str) -> Account | None:
        return self._accounts.get(user_id)

    async def find_by_display_name(self, display_name: str) -> Account | None:
        folded = display_name.casefold()
        for account in self._accounts.values():
            if account.display_name.casefold() == folded:
                return account
        return None

    async def find_by_external(self, issuer: str, subject: str) -> Account | None:
        for account in self._accounts.values():
            if account.external_issuer == issuer and account.external_subject == subject:
                return account
        return None

    async def register(
        self, user_id: str, display_name: str, recovery_hash: str
    ) -> Account:
        existing = self._accounts.get(user_id)
        account = Account(
            user_id=user_id,
            display_name=display_name,
            registered=True,
            created_at=existing.created_at if existing else _now(),
            external_issuer=existing.external_issuer if existing else None,
            external_subject=existing.external_subject if existing else None,
        )
        self._accounts[user_id] = account
        self._recovery[user_id] = recovery_hash
        return account

    async def rename(self, user_id: str, display_name: str) -> Account:
        existing = self._accounts[user_id]
        renamed = Account(
            user_id=existing.user_id,
            display_name=display_name,
            registered=existing.registered,
            created_at=existing.created_at,
            external_issuer=existing.external_issuer,
            external_subject=existing.external_subject,
        )
        self._accounts[user_id] = renamed
        return renamed

    async def recovery_hash_for(self, user_id: str) -> str | None:
        return self._recovery.get(user_id)

    async def set_recovery_hash(self, user_id: str, recovery_hash: str) -> None:
        self._recovery[user_id] = recovery_hash

    async def create_session(self, token_hash: str, user_id: str) -> None:
        self._sessions[token_hash] = user_id

    async def user_id_for_session(self, token_hash: str) -> str | None:
        return self._sessions.get(token_hash)

    async def delete_session(self, token_hash: str) -> None:
        self._sessions.pop(token_hash, None)

    async def delete_sessions_for_user(self, user_id: str) -> None:
        for token_hash in [t for t, u in self._sessions.items() if u == user_id]:
            del self._sessions[token_hash]

    async def get_profile(self, user_id: str) -> PlayerProfile | None:
        return self._profiles.get(user_id)

    async def save_profile(self, user_id: str, profile: PlayerProfile) -> None:
        self._profiles[user_id] = profile
