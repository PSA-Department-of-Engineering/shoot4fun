"""The movement routine: intent in, next movement state out.

This is the one piece of simulation that exists twice, once here and
once in the client's TypeScript, so the client can predict its own
motion without waiting for the server (`ADR-0004`). The duplication is
deliberate and is held in agreement mechanically:
`shared/movement_trace.json` is generated from this module and replayed
by both suites, so a divergence fails both builds at the first differing
step.

Everything about this module serves that contract:

* It is **pure**. Movement state, intent and arena in; movement state
  out. No room, no player, no clock, no randomness.
* It is **small**. Only what has to be predicted lives here. Weapons,
  scoring, respawn and match flow are server-only by design.
* It uses **plain float arithmetic**. No library call whose result could
  differ across the two runtimes beyond the trace's epsilon.

Two rules are worth stating because they are gameplay, not geometry:

* **All cover blocks movement, whatever its height.** Waist-high cover
  you can shoot over but not walk through is the shape of the arena's
  gameplay; `hitscan` reads the same boxes in full 3D, so a low box
  stops a body shot and not a headshot.
* **Player-versus-player separation is not predicted.** The client does
  not reliably know where other players are at the tick it is
  simulating, so the server applies separation after this routine and
  reconciliation corrects the difference. Predicting it would trade a
  visible, self-correcting nudge for constant jitter.

Vertical motion (`issue #10`) is the one addition to the flat-plane
model. Jump and crouch are predicted like everything else here, which is
why they live in this shared routine rather than server-only: a player
must see their own jump the instant they press it, not a round trip
later. The state therefore carries a vertical velocity (`vy`) alongside
the position, so a jump arc integrates across frames; nothing vertical
crosses the wire (`INT-009`), the server broadcasts the resulting
position and the client reconciles against it. Jump is held-to-bounce:
the routine is stateless, so it re-fires whenever `jump` is held and the
player is on the ground rather than tracking a key-press edge it has no
memory for.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from shoot4fun_backend.domain.constants import PLAYER_RADIUS
from shoot4fun_backend.domain.model.arena import Arena, CoverBox
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = [
    "CROUCH_SPEED_FACTOR",
    "GRAVITY",
    "GROUND_Y",
    "JUMP_SPEED",
    "MAX_FRAME_DT",
    "MOVE_SPEED",
    "PITCH_LIMIT",
    "MoveState",
    "step",
]


MOVE_SPEED: float = 6.0
"""Metres per second on the ground plane. A server constant: no client
message scales it, and it is the only ground speed in the simulation."""

CROUCH_SPEED_FACTOR: float = 0.5
"""Ground speed multiplier while crouched. Ducking is slower, which is
the cost that balances the smaller profile it buys (issue #10)."""

GRAVITY: float = 20.0
"""Downward acceleration, m/s^2. Higher than real gravity, as an arcade
shooter wants a short, snappy jump rather than a floaty one."""

JUMP_SPEED: float = 7.0
"""Upward velocity a jump imparts. With `GRAVITY` this peaks near 1.2m
and lands in about 0.7s: enough to clear a step, not enough to reach a
shoulder-high ledge."""

GROUND_Y: float = 0.0
"""The ground plane. Feet rest here; a jump raises them and gravity
returns them to it."""

MAX_FRAME_DT: float = 0.05
"""Longest span one input frame may claim. A client reporting a longer
frame has it truncated here; a client reporting many short frames is
bounded separately by `Player.grant_simulation_time`, because clamping
alone would let a flood of legal frames buy illegal distance."""

PITCH_LIMIT: float = math.pi / 2 - 0.05
"""Look clamp, short of vertical so the camera cannot flip."""

_GROUND_EPS: float = 1e-9


@dataclass(frozen=True, slots=True)
class MoveState:
    """Everything the movement routine carries between frames.

    Position is the feet; `vy` is the vertical velocity that makes a jump
    an arc rather than a single hop. A grounded, still player has
    `vy == 0` and `position.y == GROUND_Y`, which is the state every
    horizontal-only trace case starts and stays in.
    """

    position: Vec3
    vy: float = 0.0


def step(state: MoveState, frame: InputFrame, arena: Arena) -> MoveState:
    """The next movement state for a player who sent `frame`."""
    dt = frame.dt
    if dt <= 0.0:
        return state
    if dt > MAX_FRAME_DT:
        dt = MAX_FRAME_DT

    position = state.position
    vy = state.vy
    grounded = position.y <= GROUND_Y + _GROUND_EPS and vy <= 0.0
    # Crouch is a grounded stance; you cannot duck in mid-air, and holding
    # crouch keeps you planted (it suppresses the jump below).
    crouching = frame.crouch and grounded

    x, z = _horizontal(position, frame, arena, dt, crouching)
    y, vy = _vertical(position.y, vy, frame, dt, grounded, crouching)
    return MoveState(Vec3(x, y, z), vy)


def _horizontal(
    position: Vec3, frame: InputFrame, arena: Arena, dt: float, crouching: bool
) -> tuple[float, float]:
    """The next (x, z), the flat-plane part of the routine (`INT-003`)."""
    forward = (1.0 if frame.forward else 0.0) - (1.0 if frame.back else 0.0)
    strafe = (1.0 if frame.right else 0.0) - (1.0 if frame.left else 0.0)
    if forward == 0.0 and strafe == 0.0:
        return position.x, position.z

    # Yaw follows the renderer's convention so both sides agree on which
    # way "forward" points: forward is -Z rotated about Y, right is +X
    # rotated about Y. Pitch does not steer movement; you walk on the
    # ground plane whatever you are looking at.
    sin_yaw = math.sin(frame.yaw)
    cos_yaw = math.cos(frame.yaw)
    dx = -sin_yaw * forward + cos_yaw * strafe
    dz = -cos_yaw * forward - sin_yaw * strafe

    length = math.sqrt(dx * dx + dz * dz)
    if length > 0.0:
        dx /= length
        dz /= length

    speed = MOVE_SPEED * (CROUCH_SPEED_FACTOR if crouching else 1.0)
    distance = speed * dt
    x = position.x + dx * distance
    z = position.z + dz * distance

    x, z = _clamp_to_bounds(x, z, arena)
    # Deterministic order: the arena's own cover order, on both sides.
    for box in arena.cover:
        x, z = _push_out_of(x, z, box)
    return x, z


def _vertical(
    y: float, vy: float, frame: InputFrame, dt: float, grounded: bool, crouching: bool
) -> tuple[float, float]:
    """The next (y, vy): jump impulse, gravity, and the landing.

    Held-to-bounce: a grounded player holding jump gets a fresh impulse
    every frame, because the routine keeps no key-press edge. Crouch
    suppresses the jump, so ducking never launches.
    """
    if grounded and frame.jump and not crouching:
        vy = JUMP_SPEED
        grounded = False

    if grounded:
        return GROUND_Y, 0.0

    vy -= GRAVITY * dt
    y += vy * dt
    if y <= GROUND_Y:
        return GROUND_Y, 0.0
    return y, vy


def _clamp_to_bounds(x: float, z: float, arena: Arena) -> tuple[float, float]:
    min_x = arena.bounds_min.x + PLAYER_RADIUS
    max_x = arena.bounds_max.x - PLAYER_RADIUS
    min_z = arena.bounds_min.z + PLAYER_RADIUS
    max_z = arena.bounds_max.z - PLAYER_RADIUS
    if x < min_x:
        x = min_x
    elif x > max_x:
        x = max_x
    if z < min_z:
        z = min_z
    elif z > max_z:
        z = max_z
    return x, z


def _push_out_of(x: float, z: float, box: CoverBox) -> tuple[float, float]:
    """Resolve a player circle against one cover box.

    The box is expanded by the player's radius and the player treated as
    a point, which turns circle-versus-box into point-versus-box: no
    square roots, no tie-break ambiguity, and an identical result in
    both runtimes. The point leaves by whichever face is nearest, so
    sliding along cover falls out for free.
    """
    min_x = box.center.x - box.half_x - PLAYER_RADIUS
    max_x = box.center.x + box.half_x + PLAYER_RADIUS
    min_z = box.center.z - box.half_z - PLAYER_RADIUS
    max_z = box.center.z + box.half_z + PLAYER_RADIUS
    if not (min_x < x < max_x and min_z < z < max_z):
        return x, z

    to_min_x = x - min_x
    to_max_x = max_x - x
    to_min_z = z - min_z
    to_max_z = max_z - z
    nearest = min(to_min_x, to_max_x, to_min_z, to_max_z)
    if nearest == to_min_x:
        return min_x, z
    if nearest == to_max_x:
        return max_x, z
    if nearest == to_min_z:
        return x, min_z
    return x, max_z
