"""Weapon definition.

A weapon is a pure-data value object: the gameplay constants drive the
client's HUD (ammo display, reload indicator) and the server's hit
application. There is no per-instance state on a Weapon; the player's
magazine (the live counter) lives on the Player aggregate.
"""
from __future__ import annotations

from dataclasses import dataclass

__all__ = ["Weapon"]


@dataclass(frozen=True, slots=True)
class Weapon:
    id: str
    name: str
    rate_of_fire: float
    magazine_size: int
    damage: int
    reload_time: float

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "rate_of_fire": self.rate_of_fire,
            "magazine_size": self.magazine_size,
            "damage": self.damage,
            "reload_time": self.reload_time,
        }


WEAPON_RIFLE = Weapon(
    id="rifle",
    name="Rifle",
    rate_of_fire=6.0,
    magazine_size=30,
    damage=25,
    reload_time=2.0,
)

WEAPON_SMG = Weapon(
    id="smg",
    name="SMG",
    rate_of_fire=10.0,
    magazine_size=40,
    damage=15,
    reload_time=2.5,
)

DEFAULT_WEAPONS: dict[str, Weapon] = {
    w.id: w for w in (WEAPON_RIFLE, WEAPON_SMG)
}
