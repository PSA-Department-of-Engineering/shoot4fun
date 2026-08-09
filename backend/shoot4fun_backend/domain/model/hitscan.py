"""Hit resolution: a ray from the shooter's eye, tested against the world.

The server owns this entirely (`ADR-0003`). A client says where it was
looking; it never says what it hit, so there is no message a cheating
client can send to choose a victim.

Geometry:

* **Players are vertical capsules**, approximated as a cylinder of
  `PLAYER_RADIUS` spanning the ground to the target's capsule height at
  its feet. A standing capsule reaches `PLAYER_HEIGHT`; a crouched one
  is shorter (issue #10), so a duck behind waist-high cover puts the
  whole body below a ray that would clear a standing one. A hit in the
  top of the capsule (`HEAD_FRACTION` of its height) is a headshot and
  multiplies damage, so the headshot line drops with the crouch.
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
    "HEAD_FRACTION",
    "HEAD_HEIGHT",
    "HitResult",
    "TargetGeom",
    "eye_of",
    "look_direction",
    "resolve",
]


BULLET_RANGE: float = 80.0
"""Metres a shot carries. Beyond this the ray simply misses."""

HEAD_HEIGHT: float = 1.45
"""Height above the feet at which a hit on a standing player counts as a
headshot. Kept as the named constant it always was; the crouch case
reads the fraction it represents instead (`HEAD_FRACTION`)."""

HEAD_FRACTION: float = HEAD_HEIGHT / PLAYER_HEIGHT
"""The headshot line as a fraction of capsule height, so it scales with
a crouch. At the standing height it is exactly `HEAD_HEIGHT`."""

HEADSHOT_MULTIPLIER: float = 2.0


@dataclass(frozen=True, slots=True)
class TargetGeom:
    """A hittable player: where its feet are, and how tall it stands.

    Carrying the height here (rather than assuming `PLAYER_HEIGHT`) is
    what lets a crouched player present a shorter capsule, and lets the
    rewind carry the stance the shooter actually saw (issue #10).
    """

    feet: Vec3
    height: float = PLAYER_HEIGHT


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


def eye_of(position: Vec3, eye_height: float = PLAYER_EYE_HEIGHT) -> Vec3:
    """The shot origin for a player whose feet are at `position`.

    `eye_height` defaults to standing; a crouched shooter passes their
    lower eye, so their own shots leave from where their camera is.
    """
    return Vec3(position.x, position.y + eye_height, position.z)


def resolve(
    origin: Vec3,
    direction: Vec3,
    targets: dict[str, TargetGeom],
    arena: Arena,
    max_range: float = BULLET_RANGE,
) -> HitResult | None:
    """Nearest player hit along the ray, or None if blocked or missed.

    `targets` maps player id to the target's feet and capsule height and
    must already exclude the shooter and the dead.
    """
    blocking = _nearest_cover(origin, direction, arena, max_range)

    best: HitResult | None = None
    for target_id, geom in targets.items():
        hit = _cylinder_hit(origin, direction, geom.feet, geom.height, max_range)
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
                is_headshot=(point.y - geom.feet.y) >= geom.height * HEAD_FRACTION,
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
    origin: Vec3, direction: Vec3, feet: Vec3, height: float, max_range: float
) -> tuple[float, Vec3] | None:
    """Ray versus the vertical cylinder of `height` standing on `feet`."""
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
    if y < feet.y or y > feet.y + height:
        return None
    return distance, Vec3(
        origin.x + direction.x * distance,
        y,
        origin.z + direction.z * distance,
    )
