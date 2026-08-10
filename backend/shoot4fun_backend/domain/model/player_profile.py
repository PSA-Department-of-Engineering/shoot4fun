"""The preferences that follow an account across browsers and machines.

Guests keep these in the browser exactly as before. For a signed-in player the
account is the source, so the same dials arrive on a second machine already set.

Ranges are clamped in the domain rather than at the edge: a value that reaches
the store out of range is one every reader has to defend against forever.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

__all__ = [
    "DEFAULT_PROFILE",
    "PlayerProfile",
    "SENSITIVITY_MAX",
    "SENSITIVITY_MIN",
]

# The dial the client actually offers: radians of yaw per pixel, shared by the
# mouse and the look pad. Kept identical to the client's own bounds, because a
# server range wider than the control is a range no player can reach and every
# reader still has to defend against.
SENSITIVITY_MIN = 0.0005
SENSITIVITY_MAX = 0.005


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


@dataclass(frozen=True, slots=True)
class PlayerProfile:
    sensitivity: float
    touch_sensitivity: float
    master_volume: float
    sfx_volume: float
    haptics_enabled: bool

    def clamped(self) -> PlayerProfile:
        return replace(
            self,
            sensitivity=_clamp(self.sensitivity, SENSITIVITY_MIN, SENSITIVITY_MAX),
            touch_sensitivity=_clamp(self.touch_sensitivity, SENSITIVITY_MIN, SENSITIVITY_MAX),
            master_volume=_clamp(self.master_volume, 0.0, 1.0),
            sfx_volume=_clamp(self.sfx_volume, 0.0, 1.0),
        )


# The same defaults the client applies to a player who never opens the panel, so
# signing in on a fresh device changes nothing a guest would not already have.
DEFAULT_PROFILE = PlayerProfile(
    sensitivity=0.0022,
    touch_sensitivity=0.0022,
    master_volume=0.7,
    sfx_volume=0.8,
    haptics_enabled=True,
)
