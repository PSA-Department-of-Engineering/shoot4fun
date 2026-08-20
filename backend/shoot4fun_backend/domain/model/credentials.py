"""The session token and the password digest: the two secrets an account has.

The session token is minted here and never accepted from a caller. The password
digest is a caller-chosen value, so it is stored through `hash_secret` exactly
like the session token: a leaked store is not a set of usable bearer tokens.

Both secrets are above the entropy line for a fast digest (`REF-Identity.md`
section 4): the session token is CSPRNG-drawn, and a human password is enforced
to a minimum length at the boundary before it reaches this module. A memory-hard
KDF is deferred until a genuinely low-entropy credential shape demands it; the
digest function stays the single approved one either way.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

__all__ = [
    "SESSION_TOKEN_BITS",
    "hash_secret",
    "mint_session_token",
    "verify_secret",
]

SESSION_TOKEN_BITS = 256


def _token(bits: int) -> str:
    return secrets.token_hex(bits // 8)


def mint_session_token() -> str:
    """A fresh session token: opaque, and the only thing that authenticates."""
    return _token(SESSION_TOKEN_BITS)


def hash_secret(secret: str) -> str:
    """The at-rest form. A session token is a credential too, so it is stored
    as a digest exactly like a password: a leaked session table must not
    be a set of usable bearer tokens."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def verify_secret(candidate: str, stored_hash: str) -> bool:
    """Constant-time comparison, unconditionally.

    `REF-Identity.md` section 4 authors this above the published bar: the
    verification standard gates it at its highest level only, which reflects the
    standard's cost model rather than ours. It is one library call.
    """
    if not candidate or not stored_hash:
        return False
    return hmac.compare_digest(hash_secret(candidate), stored_hash)
