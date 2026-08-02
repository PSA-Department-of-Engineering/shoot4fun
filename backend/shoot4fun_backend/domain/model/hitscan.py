"""Hit resolution: a ray from the shooter's eye, tested against the world.

The server owns this entirely (`ADR-0003`). A client says where it was
looking; it never says what it hit, so there is no message a cheating
client can send to choose a victim.

Geometry:

* **Players are vertical capsules**, approximated as a cylinder of
  `PLAYER_RADIUS` spanning the ground to `PLAYER_HEIGHT` at the
  player's feet. A hit above `HEAD_HEIGHT` is a headshot and multiplies
  damage.
* **Cover is a full 3D box.** `movement` reads the same boxes flat, so
  a waist-high crate stops a body shot at close range, blocks nothing
  aimed above it, and is impassable on foot either way.
* **The nearest surface wins.** If a cover box is closer than the
  nearest player along the ray, the shot is blocked.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from shoot4fun_backend.domain.constants import (
    PLAYER_EYE_HEIGHT,
    PLAYER_HEIGHT,
    PLAYER_RADIUS,
)
from shoot4fun_backend.domain.model.arena import Arena, CoverBox
from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = [
    "BULLET_RANGE",
    "HEADSHOT_MULTIPLIER",
    "HEAD_HEIGHT",
    "HitResult",
    "eye_of",
    "look_direction",
    "resolve",
]


BULLET_RANGE: float = 80.0
"""Metres a shot carries. Beyond this the ray simply misses."""

HEAD_HEIGHT: float = 1.45
"""Height above the feet at which a hit counts as a headshot."""

HEADSHOT_MULTIPLIER: float = 2.0


@dataclass(frozen=True, slots=True)
class HitResult:
    target_id: str
    distance: float
    point: Vec3
    is_headshot: bool


def look_direction(yaw: float, pitch: float) -> Vec3:
    """The unit vector the player is looking along.

    Matches the renderer's YXZ camera convention exactly, so the ray the
    server tests is the ray the crosshair marked (`ADR-0002`).
    """
    cos_pitch = math.cos(pitch)
    return Vec3(
        -math.sin(yaw) * cos_pitch,
        math.sin(pitch),
        -math.cos(yaw) * cos_pitch,
    )


def eye_of(position: Vec3) -> Vec3:
    """The shot origin for a player standing at `position`."""
    return Vec3(position.x, position.y + PLAYER_EYE_HEIGHT, position.z)


def resolve(
    origin: Vec3,
    direction: Vec3,
    targets: dict[str, Vec3],
    arena: Arena,
    max_range: float = BULLET_RANGE,
) -> HitResult | None:
    """Nearest player hit along the ray, or None if blocked or missed.

    `targets` maps player id to feet position and must already exclude
    the shooter and the dead.
    """
    blocking = _nearest_cover(origin, direction, arena, max_range)

    best: HitResult | None = None
    for target_id, feet in targets.items():
        hit = _cylinder_hit(origin, direction, feet, max_range)
        if hit is None:
            continue
        distance, point = hit
        if distance >= blocking:
            continue
        if best is None or distance < best.distance:
            best = HitResult(
                target_id=target_id,
                distance=distance,
                point=point,
                is_headshot=(point.y - feet.y) >= HEAD_HEIGHT,
            )
    return best


def _nearest_cover(
    origin: Vec3, direction: Vec3, arena: Arena, max_range: float
) -> float:
    """Distance to the first cover box along the ray, else `max_range`."""
    nearest = max_range
    for box in arena.cover:
        distance = _box_hit(origin, direction, box, nearest)
        if distance is not None and distance < nearest:
            nearest = distance
    return nearest


def _box_hit(
    origin: Vec3, direction: Vec3, box: CoverBox, limit: float
) -> float | None:
    """Ray versus axis-aligned box by the slab method."""
    t_min = 0.0
    t_max = limit
    for o, d, centre, half in (
        (origin.x, direction.x, box.center.x, box.half_x),
        (origin.y, direction.y, box.center.y, box.half_y),
        (origin.z, direction.z, box.center.z, box.half_z),
    ):
        low = centre - half
        high = centre + half
        if abs(d) < 1e-9:
            # Parallel to this slab: a miss unless the ray starts inside it.
            if o < low or o > high:
                return None
            continue
        t1 = (low - o) / d
        t2 = (high - o) / d
        if t1 > t2:
            t1, t2 = t2, t1
        if t1 > t_min:
            t_min = t1
        if t2 < t_max:
            t_max = t2
        if t_min > t_max:
            return None
    return t_min


def _cylinder_hit(
    origin: Vec3, direction: Vec3, feet: Vec3, max_range: float
) -> tuple[float, Vec3] | None:
    """Ray versus the vertical cylinder standing on `feet`."""
    ox = origin.x - feet.x
    oz = origin.z - feet.z
    a = direction.x * direction.x + direction.z * direction.z
    if a < 1e-9:
        # Straight up or down: it cannot enter a vertical cylinder's side.
        return None
    b = 2.0 * (direction.x * ox + direction.z * oz)
    c = ox * ox + oz * oz - PLAYER_RADIUS * PLAYER_RADIUS
    discriminant = b * b - 4.0 * a * c
    if discriminant < 0.0:
        return None

    root = math.sqrt(discriminant)
    distance = (-b - root) / (2.0 * a)
    if distance < 0.0:
        # Origin inside the cylinder: take the exit face instead.
        distance = (-b + root) / (2.0 * a)
    if distance < 0.0 or distance > max_range:
        return None

    y = origin.y + direction.y * distance
    if y < feet.y or y > feet.y + PLAYER_HEIGHT:
        return None
    return distance, Vec3(
        origin.x + direction.x * distance,
        y,
        origin.z + direction.z * distance,
    )
