"""Arena layout.

A bounded flat ground plane populated with simple cover objects. The MVP
ships one arena (`MAP-001`); the P2 plan adds a second arena selectable
from the lobby (`MAP2-002`). The server carries the *server-side* layout
(bounds + cover positions) for collision and respawn; the visual scene
is the client's, and the two agree on the layout the host picked.

`cover` is a list of axis-aligned boxes (centre + half-extents). The
collision check is `AABB-vs-AABB`; the player-to-player check is a
sphere-vs-sphere at the player's `position` with a fixed `radius`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = ["Arena", "ARENA_SANDBOX", "ARENA_ATRIUM", "DEFAULT_ARENAS"]


@dataclass(frozen=True, slots=True)
class CoverBox:
    center: Vec3
    half_x: float
    half_y: float
    half_z: float

    def to_dict(self) -> dict:
        return {
            "center": self.center.to_dict(),
            "half_x": self.half_x,
            "half_y": self.half_y,
            "half_z": self.half_z,
        }


@dataclass(frozen=True, slots=True)
class Arena:
    id: str
    name: str
    bounds_min: Vec3
    bounds_max: Vec3
    cover: tuple[CoverBox, ...] = field(default_factory=tuple)
    spawn_points: tuple[Vec3, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "bounds_min": self.bounds_min.to_dict(),
            "bounds_max": self.bounds_max.to_dict(),
            "cover": [c.to_dict() for c in self.cover],
            "spawn_points": [p.to_dict() for p in self.spawn_points],
        }


ARENA_SANDBOX = Arena(
    id="sandbox",
    name="Sandbox",
    bounds_min=Vec3(-30.0, 0.0, -30.0),
    bounds_max=Vec3(30.0, 0.0, 30.0),
    cover=(
        CoverBox(Vec3(-6.0, 0.75, -4.0), 2.0, 0.75, 0.4),
        CoverBox(Vec3(6.0, 0.75, 4.0), 2.0, 0.75, 0.4),
        CoverBox(Vec3(0.0, 0.5, 8.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(0.0, 0.5, -8.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(-12.0, 0.5, 12.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(12.0, 0.5, -12.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(0.0, 1.5, 0.0), 0.4, 1.5, 0.4),
        CoverBox(Vec3(-15.0, 0.5, 0.0), 1.0, 0.5, 1.0),
    ),
    spawn_points=(
        Vec3(-20.0, 0.0, -20.0),
        Vec3(20.0, 0.0, -20.0),
        Vec3(-20.0, 0.0, 20.0),
        Vec3(20.0, 0.0, 20.0),
    ),
)


ARENA_ATRIUM = Arena(
    id="atrium",
    name="Atrium",
    bounds_min=Vec3(-25.0, 0.0, -25.0),
    bounds_max=Vec3(25.0, 0.0, 25.0),
    cover=(
        CoverBox(Vec3(0.0, 1.0, 0.0), 4.0, 1.0, 0.4),
        CoverBox(Vec3(-8.0, 0.5, 8.0), 1.5, 0.5, 1.5),
        CoverBox(Vec3(8.0, 0.5, -8.0), 1.5, 0.5, 1.5),
        CoverBox(Vec3(-8.0, 0.5, -8.0), 1.5, 0.5, 1.5),
        CoverBox(Vec3(8.0, 0.5, 8.0), 1.5, 0.5, 1.5),
        CoverBox(Vec3(0.0, 0.5, 12.0), 0.8, 0.5, 0.8),
        CoverBox(Vec3(0.0, 0.5, -12.0), 0.8, 0.5, 0.8),
        CoverBox(Vec3(12.0, 0.5, 0.0), 0.8, 0.5, 0.8),
    ),
    spawn_points=(
        Vec3(-18.0, 0.0, -18.0),
        Vec3(18.0, 0.0, -18.0),
        Vec3(-18.0, 0.0, 18.0),
        Vec3(18.0, 0.0, 18.0),
    ),
)


DEFAULT_ARENAS: dict[str, Arena] = {a.id: a for a in (ARENA_SANDBOX, ARENA_ATRIUM)}
