"""A player account.

A guest **is** an account. The server mints one on first entry, with an opaque
id and a generated display name; registering names it and hands over a recovery
code, upgrading the same row in place. There is no separate guest code path to
keep working, which is what makes "guests stay first-class" structural rather
than a promise, and it is why a player who registers keeps the scores they set
before they did.

`external_issuer` and `external_subject` are the federation link, empty for
every standalone player. They are here on day one because they are free at
creation and a live migration with a security window afterwards
(`REF-Identity.md` section 5): a federated subject identifier is unique only
within its issuer, so storing one without the other is ambiguous by
specification, and keying an account on an email address instead lets a second
issuer asserting that address take the account over.
"""
from __future__ import annotations

from dataclasses import dataclass

__all__ = ["Account"]


@dataclass(frozen=True, slots=True)
class Account:
    user_id: str
    display_name: str
    registered: bool
    created_at: str
    external_issuer: str | None = None
    external_subject: str | None = None
