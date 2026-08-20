"""In-memory `AccountRepository`.

The development and test backend, mirroring the Postgres adapter's semantics so
a test exercises the same service logic the deployment runs. Nothing here
survives a restart, which is exactly what a missing `DATABASE_URL` means.
"""
from __future__ import annotations

import time
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
        self._expiries: dict[str, float] = {}
        self._profiles: dict[str, PlayerProfile] = {}
        self._arsenal: dict[str, dict] = {}

    async def create_guest(
        self, user_id: str, display_name: str
    ) -> Account | None:
        # Mirrors the Postgres adapter: a taken name is no row, not a raise.
        if await self.find_by_display_name(display_name) is not None:
            return None
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

    async def create_session(
        self, token_hash: str, user_id: str, ttl_ms: int
    ) -> None:
        self._sessions[token_hash] = user_id
        self._expiries[token_hash] = time.time() + ttl_ms / 1000

    async def user_id_for_session(self, token_hash: str) -> str | None:
        expires_at = self._expiries.get(token_hash)
        if expires_at is not None and expires_at <= time.time():
            return None
        return self._sessions.get(token_hash)

    async def delete_session(self, token_hash: str) -> None:
        self._sessions.pop(token_hash, None)
        self._expiries.pop(token_hash, None)

    async def delete_sessions_for_user(self, user_id: str) -> None:
        for token_hash in [t for t, u in self._sessions.items() if u == user_id]:
            del self._sessions[token_hash]

    async def sweep(self, grace_ms: int) -> int:
        now = time.time()
        for token_hash in [t for t, e in self._expiries.items() if e <= now]:
            self._sessions.pop(token_hash, None)
            del self._expiries[token_hash]
        held = set(self._sessions.values())
        cutoff = now - grace_ms / 1000
        deleted = 0
        for user_id, account in list(self._accounts.items()):
            if account.registered or user_id in held:
                continue
            created = datetime.fromisoformat(account.created_at).timestamp()
            if created > cutoff:
                continue
            del self._accounts[user_id]
            self._recovery.pop(user_id, None)
            deleted += 1
        return deleted

    async def get_profile(self, user_id: str) -> PlayerProfile | None:
        return self._profiles.get(user_id)

    async def save_profile(self, user_id: str, profile: PlayerProfile) -> None:
        self._profiles[user_id] = profile

    async def get_arsenal(self, user_id: str) -> dict | None:
        return self._arsenal.get(user_id)

    async def save_arsenal(self, user_id: str, envelope: dict) -> None:
        self._arsenal[user_id] = envelope
