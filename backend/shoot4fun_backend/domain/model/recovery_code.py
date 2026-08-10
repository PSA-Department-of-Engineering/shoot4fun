"""The recovery code and the session token: the two secrets an account has.

Both are minted here and never accepted from a caller. A caller-chosen value is
a password whatever the endpoint calls it, and players reuse one they hold
elsewhere.

Storage follows the entropy rule rather than the credential's name
(`REF-Identity.md` section 4): above the 112-bit line an approved digest with no
salt and no memory-hard scheme is conforming and correct, because a memory-hard
KDF exists to buy back entropy a human-chosen secret lacks. Both secrets here are
drawn from the CSPRNG well above that line, so SHA-256 is the right function and
a KDF would buy only latency and a denial-of-service surface on endpoints anyone
can reach.

The corollary is a deliberate design constraint: because the digest is fast,
these values may never be shortened into something a human would type from
memory. A human-typeable code drops below the line and inverts the rule.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

__all__ = [
    "RECOVERY_CODE_BITS",
    "SESSION_TOKEN_BITS",
    "hash_secret",
    "mint_recovery_code",
    "mint_session_token",
    "verify_secret",
]

# Copy-pasted, never memorised. Base32 over 160 bits: 32 characters, no
# lowercase to mistype and no padding.
RECOVERY_CODE_BITS = 160
SESSION_TOKEN_BITS = 256

_RECOVERY_PREFIX = "s4f_"


def _token(bits: int) -> str:
    return secrets.token_hex(bits // 8)


def mint_recovery_code() -> str:
    """A fresh recovery code, shown exactly once by the call that mints it."""
    return f"{_RECOVERY_PREFIX}{_token(RECOVERY_CODE_BITS)}"


def mint_session_token() -> str:
    """A fresh session token: opaque, and the only thing that authenticates."""
    return _token(SESSION_TOKEN_BITS)


def hash_secret(secret: str) -> str:
    """The at-rest form. A session token is a credential too, so it is stored
    as a digest exactly like the recovery code: a leaked session table must not
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
