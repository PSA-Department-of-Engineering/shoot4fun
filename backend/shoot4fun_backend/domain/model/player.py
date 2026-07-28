"""Player aggregate.

The player's server-side identity. Position and rotation are
server-authoritative (`INT-009`); clients send `input` and the server
writes the resulting position. The HP invariant lives on `health`
(`INT-005`); the kill counter is per-room, not per-player (so a single
`KillCounter` on the room is the source of truth).
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field

from shoot4fun_backend.domain.model.player_health import PlayerHealth
from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = ["Player", "PLAYER_RADIUS", "MAX_PLAYER_HP"]


PLAYER_RADIUS: float = 0.45
MAX_PLAYER_HP: int = 100


@dataclass(slots=True)
class Player:
    id: str
    name: str
    position: Vec3
    yaw: float
    pitch: float
    health: PlayerHealth = field(default_factory=lambda: PlayerHealth(max=MAX_PLAYER_HP))
    kills: int = 0
    deaths: int = 0
    is_ready: bool = False
    team: int = 1
    equipped_weapon: str = "rifle"

    @staticmethod
    def new(name: str, position: Vec3, team: int = 1) -> Player:
        return Player(
            id=str(uuid.uuid4()),
            name=name,
            position=position,
            yaw=0.0,
            pitch=0.0,
            team=team,
        )

    def forward(self) -> Vec3:
        cy = math.cos(self.yaw)
        sy = math.sin(self.yaw)
        cp = math.cos(self.pitch)
        sp = math.sin(self.pitch)
        return Vec3(sy * cp, -sp, -cy * cp)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "position": self.position.to_dict(),
            "yaw": self.yaw,
            "pitch": self.pitch,
            "hp": self.health.current,
            "max_hp": self.health.max,
            "is_alive": self.health.is_alive,
            "kills": self.kills,
            "deaths": self.deaths,
            "is_ready": self.is_ready,
            "team": self.team,
            "equipped_weapon": self.equipped_weapon,
        }
