"""The Arsenal data shape: a forward-compatible envelope (ARS-004, ADR-0007).

A player's inventory and loadout will grow - weapon unlocks, outfits, stats -
so the shape that stores it must absorb new fields without a migration and
without dropping data a future client wrote. The envelope wraps an opaque
`data` object; unknown keys inside it round-trip untouched, and a newer
`version` is still readable, so a future that adds fields must not lose what a
player already has.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

__all__ = ["ArsenalEnvelope", "ARSENAL_VERSION"]

ARSENAL_VERSION = 1


@dataclass(frozen=True, slots=True)
class ArsenalEnvelope:
    version: int
    data: dict[str, Any]

    @classmethod
    def parse(cls, raw: object) -> "ArsenalEnvelope":
        """Read an envelope back, refusing anything that is not a versioned
        object with a data payload. The data object is kept verbatim, so keys
        a future shape added survive the round-trip."""
        if not isinstance(raw, dict):
            raise ValueError("arsenal envelope must be an object")
        version = raw.get("version")
        if (
            not isinstance(version, int)
            or isinstance(version, bool)
            or version < ARSENAL_VERSION
        ):
            raise ValueError("arsenal envelope needs a positive integer version")
        data = raw.get("data")
        if not isinstance(data, dict):
            raise ValueError("arsenal envelope needs a data object")
        return cls(version=version, data=data)

    def to_dict(self) -> dict[str, Any]:
        """Emit the envelope exactly as stored: version plus the untouched
        data payload, so nothing written into `data` is lost on the way out."""
        return {"version": self.version, "data": self.data}
