"""Accounts, sessions and profiles: one service, one way in.

The model is guest-with-recovery-code, selected against `REF-Identity.md`
section 2 and recorded in ADR-004. The short version: what is lost when an
account is taken here is a leaderboard rank, there is no PII, and an account is
an obstacle to the product rather than the product.

Section 1 of that REF makes the selection a pair, so the recovery rung is chosen
here too and not deferred. There is no email and no operator, which closes the
conforming recovery set to one member: a saved recovery code. That is the whole
recovery story, and its cost is stated rather than patched later - losing the
code with no live session ends the account's reachability.

`resolve_session` is the single session-resolution choke point. Every private
read and write goes through it; the public leaderboard read goes through a
deliberately separate, unscoped path. A federated session plugs in here without
touching a router.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass

from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.domain.exceptions.authentication_failed_error import (
    AuthenticationFailedError,
)
from shoot4fun_backend.domain.exceptions.display_name_taken_error import (
    DisplayNameTakenError,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.player_profile import DEFAULT_PROFILE, PlayerProfile
from shoot4fun_backend.domain.model.recovery_code import (
    hash_secret,
    mint_recovery_code,
    mint_session_token,
    verify_secret,
)
from shoot4fun_backend.logging import get_logger

__all__ = ["AccountService", "MintedAccount", "NewSession"]

_log = get_logger("account_service")

DISPLAY_NAME_MIN = 2
DISPLAY_NAME_MAX = 24

# Sessions expire. The stakes axis caps session and inactivity lifetimes
# (REF-Identity section 2), and the sweep below depends on it: a session that
# never expires keeps its guest reachable for ever, so nothing is ever
# reclaimable.
DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

# How long a freshly minted guest is safe from the sweep.
GUEST_GRACE_MS = 60 * 60 * 1000

GUEST_NAME_ATTEMPTS = 8

_ADJECTIVES = (
    "Swift", "Silent", "Crimson", "Neon", "Iron", "Rapid", "Vivid", "Lunar",
    "Solar", "Onyx", "Amber", "Cobalt", "Vector", "Zephyr", "Nova", "Echo",
)
_NOUNS = (
    "Runner", "Falcon", "Spectre", "Ranger", "Bolt", "Comet", "Drifter", "Lynx",
    "Raven", "Sentinel", "Nomad", "Pilot", "Warden", "Scout", "Vanguard", "Ace",
)


@dataclass(frozen=True, slots=True)
class NewSession:
    account: Account
    token: str


@dataclass(frozen=True, slots=True)
class MintedAccount:
    account: Account
    token: str
    recovery_code: str


def normalize_display_name(raw: str) -> str:
    """The one normalisation. The guess budget keys off this too, so a padded
    spelling lands in the same bucket as the name it resolves to."""
    cleaned = " ".join(str(raw or "").strip().split())
    if not DISPLAY_NAME_MIN <= len(cleaned) <= DISPLAY_NAME_MAX:
        raise ValueError(
            f"display name must be {DISPLAY_NAME_MIN}..{DISPLAY_NAME_MAX} characters"
        )
    if not all(c.isalnum() or c in " _-." for c in cleaned):
        raise ValueError("display name may use letters, numbers, spaces, dot, dash, underscore")
    return cleaned


def guest_name(attempt: int) -> str:
    """A generated display name, widening under pressure.

    The first attempts read like a name a person would pick, because this one
    is public wherever the account appears. A collision widens the suffix
    rather than retrying inside the same narrow space: four digits is 2.3
    million names and nine is 2.3 * 10^11, so the space a flood would have to
    exhaust is not a space it can exhaust.

    Width matters more than it looks. The name space is the only thing a
    caller can consume without presenting a credential, and a narrow one turns
    guest creation into a walk of it once it fills.
    """
    digits = 4 if attempt < 4 else 9
    span = 10**digits
    return (
        f"{secrets.choice(_ADJECTIVES)}{secrets.choice(_NOUNS)}"
        f"{secrets.randbelow(span - span // 10) + span // 10}"
    )


class AccountService:
    def __init__(
        self,
        accounts: AccountRepository,
        session_ttl_ms: int = DEFAULT_SESSION_TTL_MS,
    ) -> None:
        self._accounts = accounts
        self._session_ttl_ms = session_ttl_ms

    # ---- entry ------------------------------------------------------------

    async def start_guest(self) -> NewSession:
        """Mint a temporary account and a session for it. This is the whole
        entry path: a guest is an account from the first frame."""
        user_id = f"usr_{secrets.token_hex(12)}"
        for attempt in range(GUEST_NAME_ATTEMPTS):
            account = await self._accounts.create_guest(user_id, guest_name(attempt))
            if account is not None:
                token = await self._issue_session(user_id)
                return NewSession(account=account, token=token)
        raise RuntimeError("could not mint an unused display name")

    # ---- the choke point --------------------------------------------------

    async def resolve_session(self, token: str | None) -> str | None:
        """The userId a session token stands for, or None.

        Every private surface resolves the caller here and nowhere else. A
        claimed id, a display name, or a proxy header is never an authenticator.
        """
        if not token:
            return None
        return await self._accounts.user_id_for_session(hash_secret(token))

    async def _issue_session(self, user_id: str) -> str:
        token = mint_session_token()
        await self._accounts.create_session(
            hash_secret(token), user_id, self._session_ttl_ms
        )
        return token

    async def sign_out(self, token: str) -> None:
        await self._accounts.delete_session(hash_secret(token))

    async def sweep(self, grace_ms: int = GUEST_GRACE_MS) -> int:
        """Drop expired sessions and the guests they leave unreachable.

        A guest holds no credential but its session token: there is no recovery
        code until registering mints one, and `sign_in` refuses an unregistered
        account. So once the last session expires, nobody can ever reach that
        row again - it is dead by construction rather than by a guess about
        staleness, which is what makes deleting it safe.

        This is also what bounds the table. Guest creation takes no credential,
        so anyone can mint rows; sweeping unreachable ones caps the live count
        at roughly the creation rate times the session lifetime instead of
        letting it grow for ever.

        The grace window covers the gap between minting the account and issuing
        its first session, which are two statements.
        """
        return await self._accounts.sweep(grace_ms)

    # ---- registration and recovery ----------------------------------------

    async def register(self, user_id: str, display_name: str) -> MintedAccount:
        """Upgrade this account in place and mint its recovery code.

        The code is returned exactly once, here. Registering an account that
        already holds one renames it and leaves the code alone: minting on a
        rename would let a session alone retire the owner's written-down code
        without ever presenting it, which is what rotation demands proof for.
        """
        cleaned = normalize_display_name(display_name)
        owner = await self._accounts.find_by_display_name(cleaned)
        if owner is not None and owner.user_id != user_id:
            raise DisplayNameTakenError(cleaned)

        existing = await self._accounts.get(user_id)
        if existing is not None and existing.registered:
            renamed = await self._accounts.rename(user_id, cleaned)
            return MintedAccount(account=renamed, token="", recovery_code="")

        code = mint_recovery_code()
        account = await self._accounts.register(user_id, cleaned, hash_secret(code))
        _log.info("account registered", extra={"user_id": user_id})
        return MintedAccount(account=account, token="", recovery_code=code)

    async def sign_in(self, display_name: str, recovery_code: str) -> NewSession:
        """Trade a display name and a recovery code for a session.

        An unknown name is refused without a verification. Equalising that
        timing would defend against enumeration, and the leaderboard publishes
        every display name by design, so there is nothing to enumerate.
        """
        try:
            cleaned = normalize_display_name(display_name)
        except ValueError:
            raise AuthenticationFailedError from None
        account = await self._accounts.find_by_display_name(cleaned)
        if account is None or not account.registered:
            raise AuthenticationFailedError
        stored = await self._accounts.recovery_hash_for(account.user_id)
        if stored is None or not verify_secret(recovery_code.strip(), stored):
            raise AuthenticationFailedError
        token = await self._issue_session(account.user_id)
        return NewSession(account=account, token=token)

    async def rotate_recovery_code(self, user_id: str, current_code: str) -> MintedAccount:
        """Mint a replacement, on proof of the current one, and kill every
        existing session. Requiring the current code is what stops a stolen
        session locking the owner out of their own account."""
        stored = await self._accounts.recovery_hash_for(user_id)
        if stored is None or not verify_secret(current_code.strip(), stored):
            raise AuthenticationFailedError
        code = mint_recovery_code()
        await self._accounts.set_recovery_hash(user_id, hash_secret(code))
        await self._accounts.delete_sessions_for_user(user_id)
        account = await self._accounts.get(user_id)
        assert account is not None, "rotating a code for an account that does not exist"
        token = await self._issue_session(user_id)
        return MintedAccount(account=account, token=token, recovery_code=code)

    # ---- reads and profile -------------------------------------------------

    async def get(self, user_id: str) -> Account | None:
        return await self._accounts.get(user_id)

    async def get_profile(self, user_id: str) -> PlayerProfile:
        return await self._accounts.get_profile(user_id) or DEFAULT_PROFILE

    async def save_profile(self, user_id: str, profile: PlayerProfile) -> PlayerProfile:
        clamped = profile.clamped()
        await self._accounts.save_profile(user_id, clamped)
        return clamped

    # ---- federation --------------------------------------------------------

    async def adopt_external(self, issuer: str, subject: str) -> Account | None:
        """The seat a federated login plugs into: it ADOPTS the account already
        linked to (issuer, subject) rather than forking a second identity.

        Nothing calls this yet and nothing should build toward it. It exists
        because the alternative is a live data migration, and because the shape
        of the lookup is the thing worth fixing now: an issuer without its
        subject is ambiguous by specification.
        """
        return await self._accounts.find_by_external(issuer, subject)
