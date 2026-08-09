"""Crouch changes what `hitscan` can reach (issue #10).

Hitscan is server-only, so it is not on the shared movement trace; these
pin the two things a crouch buys and costs: a shorter capsule a level
shot can pass over, and a lower eye the shooter fires from. Standing
geometry is asserted unchanged, so `INT-004` still holds.
"""
from __future__ import annotations

from shoot4fun_backend.domain.constants import (
    PLAYER_CROUCH_EYE_HEIGHT,
    PLAYER_CROUCH_HEIGHT,
    PLAYER_EYE_HEIGHT,
    PLAYER_HEIGHT,
)
from shoot4fun_backend.domain.model.arena import Arena
from shoot4fun_backend.domain.model.hitscan import (
    HEAD_FRACTION,
    HEAD_HEIGHT,
    TargetGeom,
    eye_of,
    look_direction,
    resolve,
)
from shoot4fun_backend.domain.model.vec3 import Vec3

OPEN = Arena(
    id="open",
    name="Open",
    bounds_min=Vec3(-100.0, 0.0, -100.0),
    bounds_max=Vec3(100.0, 0.0, 100.0),
    cover=(),
    spawn_points=(Vec3(0.0, 0.0, 0.0),),
)


def test_eye_of_uses_the_given_eye_height() -> None:
    feet = Vec3(1.0, 0.0, 2.0)
    assert eye_of(feet).y == feet.y + PLAYER_EYE_HEIGHT
    assert eye_of(feet, PLAYER_CROUCH_EYE_HEIGHT).y == feet.y + PLAYER_CROUCH_EYE_HEIGHT


def test_the_standing_headshot_line_is_unchanged() -> None:
    # HEAD_FRACTION is defined so a standing capsule's head line is
    # exactly the old absolute HEAD_HEIGHT: INT-004 is untouched.
    assert PLAYER_HEIGHT * HEAD_FRACTION == HEAD_HEIGHT


def test_a_level_shot_over_a_crouched_body_misses_where_a_standing_one_is_hit() -> None:
    # Shooter looks dead level (pitch 0) at eye height, straight down -Z.
    origin = eye_of(Vec3(0.0, 0.0, 0.0))  # y = 1.6
    direction = look_direction(0.0, 0.0)  # (0, 0, -1)
    feet = Vec3(0.0, 0.0, -5.0)

    standing = resolve(origin, direction, {"t": TargetGeom(feet, PLAYER_HEIGHT)}, OPEN)
    assert standing is not None
    assert standing.target_id == "t"

    # The same shot, same aim: a crouched capsule tops out below the
    # 1.6m ray, so it passes clean over the ducked player.
    crouched = resolve(
        origin, direction, {"t": TargetGeom(feet, PLAYER_CROUCH_HEIGHT)}, OPEN
    )
    assert crouched is None


def test_the_headshot_line_scales_down_with_the_crouch() -> None:
    # Aim slightly down so the ray meets a crouched capsule near its top.
    origin = eye_of(Vec3(0.0, 0.0, 0.0), PLAYER_CROUCH_EYE_HEIGHT)
    direction = look_direction(0.0, -0.05)
    feet = Vec3(0.0, 0.0, -3.0)
    hit = resolve(
        origin, direction, {"t": TargetGeom(feet, PLAYER_CROUCH_HEIGHT)}, OPEN
    )
    assert hit is not None
    # The hit lands above the crouched head line, which is well under the
    # standing 1.45m: a crouched head can still be a headshot.
    crouch_head_line = PLAYER_CROUCH_HEIGHT * HEAD_FRACTION
    assert crouch_head_line < HEAD_HEIGHT
    assert hit.is_headshot == ((hit.point.y - feet.y) >= crouch_head_line)
