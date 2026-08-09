"""The server half of the shared-trace gate (`ADR-0004`).

`shared/movement_trace.json` is generated from `movement.step`, and the
client's TypeScript suite replays the same file against its own mirror
of the routine. This module replays it against the server routine, so
the fixture binds both sides rather than only the client:

* Editing `movement.py` without regenerating the trace fails here.
* Editing the client's mirror to match an unregenerated trace fails
  there.

Either way the two implementations cannot drift in silence, which is
the whole reason the duplication is allowed to exist.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_intent

from shoot4fun_backend.domain.model.arena import Arena, CoverBox
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.movement import MoveState, step
from shoot4fun_backend.domain.model.vec3 import Vec3

TRACE_PATH = Path(__file__).resolve().parents[3].parent / "shared" / "movement_trace.json"
REGENERATE = "python backend/scripts/generate_movement_trace.py"


def _load() -> dict:
    if not TRACE_PATH.is_file():
        pytest.fail(f"missing {TRACE_PATH}; generate it with: {REGENERATE}")
    return json.loads(TRACE_PATH.read_text(encoding="utf-8"))


def _vec(raw: dict) -> Vec3:
    return Vec3(float(raw["x"]), float(raw["y"]), float(raw["z"]))


def _arena(raw: dict) -> Arena:
    return Arena(
        id=raw["id"],
        name=raw["name"],
        bounds_min=_vec(raw["bounds_min"]),
        bounds_max=_vec(raw["bounds_max"]),
        cover=tuple(
            CoverBox(
                center=_vec(c["center"]),
                half_x=float(c["half_x"]),
                half_y=float(c["half_y"]),
                half_z=float(c["half_z"]),
            )
            for c in raw["cover"]
        ),
        spawn_points=tuple(_vec(p) for p in raw["spawn_points"]),
    )


TRACE = _load()


@pytest_intent.intent("INT-003")
@pytest.mark.parametrize("case", TRACE["cases"], ids=lambda c: c["name"])
def test_movement_matches_the_shared_trace(case: dict) -> None:
    arena = _arena(case["arena"])
    epsilon = float(TRACE["epsilon"])
    state = MoveState(_vec(case["start"]), 0.0)

    # strict: a case whose frames and expectations differ in length is a
    # corrupt fixture, and silently replaying the shorter one would pass.
    for index, (raw, want) in enumerate(
        zip(case["frames"], case["expected"], strict=True)
    ):
        state = step(
            state,
            InputFrame(
                seq=0,
                dt=float(raw["dt"]),
                yaw=float(raw["yaw"]),
                forward=bool(raw["forward"]),
                back=bool(raw["back"]),
                left=bool(raw["left"]),
                right=bool(raw["right"]),
                jump=bool(raw.get("jump")),
                crouch=bool(raw.get("crouch")),
            ),
            arena,
        )
        position = state.position
        # x, z is the flat plane; y is the jump/crouch simulation (issue
        # #10). All three are pinned, so a vertical divergence fails the
        # gate exactly as a horizontal one does.
        for axis in ("x", "y", "z"):
            assert abs(getattr(position, axis) - float(want[axis])) <= epsilon, (
                f"{case['name']}: {axis} diverged at step {index} "
                f"(got {getattr(position, axis)}, want {want[axis]}). "
                f"Regenerate with: {REGENERATE}"
            )
