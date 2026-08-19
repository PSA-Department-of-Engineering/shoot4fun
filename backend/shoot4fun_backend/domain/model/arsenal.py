"""The Arsenal data shape: the inventory/loadout that follows a signed-in
player across devices (ARS-004).

It is a versioned envelope that preserves unknown fields, so a future that
adds weapon unlocks, outfits, or stats grows the shape without losing a
player's existing data (ADR-0007). The known keys today are `model` (the
player-model id) and `loadout` (a bag of slot -> item); everything else is
carried in `extras` and round-trips untouched. The server never drops a key
it does not understand, which is the property the claim INT-029 tests.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

__all__ = ["ARSENAL_ENVELOPE_VERSION", "DEFAULT_ARSENAL", "PlayerArsenal"]

ARSENAL_ENVELOPE_VERSION = 1

_KNOWN_KEYS = ("version", "model", "loadout")


@dataclass(frozen=True, slots=True)
class PlayerArsenal:
    """A player's arsenal, carried in a forward-compatible envelope.

    `version` is the envelope version, not the game's; `model` is the
    player-model id the Arsenal view renders, `loadout` the current
    inventory/loadout, and `extras` every field the current build does not
    name - preserved so a future shape can read what an older client wrote.
    """

    version: int
    model: str | None
    loadout: Mapping[str, Any]
    extras: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "version": self.version,
            "model": self.model,
            "loadout": dict(self.loadout),
        }
        data.update(self.extras)
        return data

    @staticmethod
    def from_dict(data: Mapping[str, Any]) -> "PlayerArsenal":
        extras = {k: v for k, v in data.items() if k not in _KNOWN_KEYS}
        loadout = data.get("loadout")
        return PlayerArsenal(
            version=int(data.get("version", ARSENAL_ENVELOPE_VERSION)),
            model=data.get("model"),
            loadout=dict(loadout) if isinstance(loadout, Mapping) else {},
            extras=extras,
        )


DEFAULT_ARSENAL = PlayerArsenal(
    version=ARSENAL_ENVELOPE_VERSION,
    model=None,
    loadout={},
    extras={},
)
