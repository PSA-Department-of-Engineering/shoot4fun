"""Jump and crouch, read directly off `movement.step` (issue #10).

The shared trace (`test_movement_trace`) pins these against the client
too; these are the readable, single-runtime statements of the same
behaviour, so a change to the physics is legible here and not only as a
fixture diff.
"""
from __future__ import annotations

from shoot4fun_backend.domain.model.arena import Arena
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.movement import (
    CROUCH_SPEED_FACTOR,
    GROUND_Y,
    MOVE_SPEED,
    MoveState,
    step,
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

TICK = 1.0 / 60.0


def _grounded(pos: Vec3) -> MoveState:
    return MoveState(pos, 0.0)


def test_jump_leaves_the_ground_and_gains_upward_velocity() -> None:
    after = step(_grounded(Vec3(0.0, 0.0, 0.0)), InputFrame(0, TICK, jump=True), OPEN)
    assert after.position.y > GROUND_Y
    assert after.vy > 0.0


def test_a_jump_arc_rises_and_returns_to_the_ground() -> None:
    state = step(_grounded(Vec3(0.0, 0.0, 0.0)), InputFrame(0, TICK, jump=True), OPEN)
    peak = state.position.y
    # Let it fall back with no further input, tracking the apex.
    for _ in range(120):
        state = step(state, InputFrame(0, TICK), OPEN)
        peak = max(peak, state.position.y)
    assert peak > 1.0  # cleared a step's worth of height
    assert state.position.y == GROUND_Y
    assert state.vy == 0.0


def test_crouch_walks_at_half_the_ground_speed() -> None:
    stand = step(_grounded(Vec3(0.0, 0.0, 0.0)), InputFrame(0, TICK, forward=True), OPEN)
    crouch = step(
        _grounded(Vec3(0.0, 0.0, 0.0)),
        InputFrame(0, TICK, forward=True, crouch=True),
        OPEN,
    )
    stand_dist = abs(stand.position.z)
    crouch_dist = abs(crouch.position.z)
    assert crouch_dist == stand_dist * CROUCH_SPEED_FACTOR
    assert crouch_dist > 0.0
    assert stand_dist == MOVE_SPEED * TICK


def test_crouch_suppresses_the_jump() -> None:
    after = step(
        _grounded(Vec3(0.0, 0.0, 0.0)),
        InputFrame(0, TICK, jump=True, crouch=True),
        OPEN,
    )
    assert after.position.y == GROUND_Y
    assert after.vy == 0.0


def test_holding_jump_bounces_and_never_sinks_below_ground() -> None:
    state = _grounded(Vec3(0.0, 0.0, 0.0))
    left_ground = False
    for _ in range(180):
        state = step(state, InputFrame(0, TICK, jump=True), OPEN)
        assert state.position.y >= GROUND_Y
        left_ground = left_ground or state.position.y > GROUND_Y
    assert left_ground  # a held jump does leave the floor


def test_a_grounded_idle_player_stays_flat() -> None:
    after = step(_grounded(Vec3(3.0, 0.0, -4.0)), InputFrame(0, TICK), OPEN)
    assert after.position == Vec3(3.0, GROUND_Y, -4.0)
    assert after.vy == 0.0
