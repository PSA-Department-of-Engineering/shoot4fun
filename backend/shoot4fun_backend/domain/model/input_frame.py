"""One frame of player intent.

The only thing a client is allowed to say about motion (`ADR-0003`).
It carries what a human did, never what the world should become: which
movement keys were held, whether jump or crouch were held, where the
player was looking, whether the trigger was down, and how long the
frame covered.

`jump` and `crouch` are the vertical intent `movement.step` reads to
give the player an upward velocity and a ducked stance (`INT-003`, issue
#10). They are buttons like any other: the client sends what the human
held, and the server integrates the effect, so no position, velocity or
height ever crosses the wire (`INT-009`).

`seq` is the client's monotonic frame counter. The server echoes the
last one it consumed in every snapshot, which is what lets the client
replay its unacknowledged inputs after a correction (`ADR-0004`).

`ack_tick` is the last server tick the client had drawn when the frame
was produced. It is what makes lag compensation possible without
estimating anyone's ping: the server rewinds the world to the tick the
shooter was actually looking at, bounded so a client cannot claim to
have been viewing an arbitrarily distant past.

`dt` is attacker-controlled and is treated as such: `movement.step`
clamps it per frame, and `Player.grant_simulation_time` bounds the
total across frames against real elapsed time, so neither a single long
frame nor a flood of short ones buys distance.
"""
from __future__ import annotations

from dataclasses import dataclass

__all__ = ["InputFrame"]


@dataclass(frozen=True, slots=True)
class InputFrame:
    seq: int
    dt: float
    ack_tick: int = 0
    forward: bool = False
    back: bool = False
    left: bool = False
    right: bool = False
    fire: bool = False
    jump: bool = False
    crouch: bool = False
    yaw: float = 0.0
    pitch: float = 0.0

    @staticmethod
    def from_wire(msg: dict) -> InputFrame:
        """Parse a client `input` message, coercing every field.

        Unknown and missing fields degrade to a neutral frame rather
        than raising: a malformed input is a dropped frame, not a
        disconnected player.
        """
        buttons = msg.get("buttons") or {}
        if not isinstance(buttons, dict):
            buttons = {}
        return InputFrame(
            seq=_as_int(msg.get("seq")),
            dt=_as_float(msg.get("dt")),
            ack_tick=_as_int(msg.get("ack_tick")),
            forward=bool(buttons.get("forward")),
            back=bool(buttons.get("back")),
            left=bool(buttons.get("left")),
            right=bool(buttons.get("right")),
            fire=bool(buttons.get("fire")),
            jump=bool(buttons.get("jump")),
            crouch=bool(buttons.get("crouch")),
            yaw=_as_float(msg.get("yaw")),
            pitch=_as_float(msg.get("pitch")),
        )


def _as_float(value: object) -> float:
    try:
        out = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    # NaN and infinity poison every downstream comparison, including the
    # bounds clamp, so they are rejected at the edge rather than clamped.
    if out != out or out in (float("inf"), float("-inf")):
        return 0.0
    return out


def _as_int(value: object) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
