"""The guess budget on the credential-accepting endpoints.

Keyed on the account under attack, because that is the only origin this process
owns (`REF-Identity.md` section 4). Behind the cluster gateway the socket peer is
the gateway for every player and the forwarded chain is a header the caller
writes, so budgeting on either hands out the denial of service the control exists
to prevent: omit the header and one caller spends a bucket everyone shares.

The key derives from the same normalisation the lookup uses, so a padded spelling
lands in the victim's bucket rather than a fresh one. Keys are bounded and the
map has a ceiling, because a budget that remembers a caller for a window is an
allocation the caller drives.
"""
from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass

__all__ = ["GuessBudget"]

_WINDOW_SECONDS = 300.0
_MAX_ATTEMPTS = 10
_MAX_KEYS = 50_000
_SWEEP_THRESHOLD = 1024


@dataclass
class _Window:
    count: int
    resets_at: float


class GuessBudget:
    def __init__(
        self,
        max_attempts: int = _MAX_ATTEMPTS,
        window_seconds: float = _WINDOW_SECONDS,
        clock: Callable[[], float] | None = None,
        max_keys: int = _MAX_KEYS,
    ) -> None:
        self._max_attempts = max_attempts
        self._window = window_seconds
        self._clock = clock or time.monotonic
        self._max_keys = max_keys
        self._windows: dict[str, _Window] = {}

    def check(self, key: str) -> bool:
        """Charge one attempt and report whether it may proceed.

        Charging on the attempt rather than on the failure is deliberate: a
        limiter that counts only failures is paced by the attacker's success.
        """
        now = self._clock()
        self._sweep(now)
        window = self._windows.get(key)
        if window is None or window.resets_at <= now:
            if window is None and len(self._windows) >= self._max_keys:
                return False
            self._windows[key] = _Window(count=1, resets_at=now + self._window)
            return True
        window.count += 1
        return window.count <= self._max_attempts

    def clear(self, key: str) -> None:
        """A correct credential proves the caller is not guessing."""
        self._windows.pop(key, None)

    def _sweep(self, now: float) -> None:
        if len(self._windows) < min(_SWEEP_THRESHOLD, self._max_keys):
            return
        for key in [k for k, w in self._windows.items() if w.resets_at <= now]:
            del self._windows[key]
