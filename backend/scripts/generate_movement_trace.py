"""Generate the shared movement trace (`ADR-0004`).

The client predicts its own motion, which means the movement routine
exists twice, in Python here and in TypeScript in the client. This
script is what stops the two drifting: it replays a set of input
sequences through the server's routine, which is the authority, and
writes the positions it produced to `shared/movement_trace.json`. Both
test suites replay that file, so a divergence fails both builds and
names the first differing step.

Regenerating is a deliberate act that shows up as a diff. The client is
never the reason the file changes.

    python scripts/generate_movement_trace.py
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

# Runs whether or not the package is installed, matching the sibling
# scripts in this directory.
_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from shoot4fun_backend.domain.model.arena import DEFAULT_ARENAS  # noqa: E402
from shoot4fun_backend.domain.model.input_frame import InputFrame  # noqa: E402
from shoot4fun_backend.domain.model.movement import MoveState, step  # noqa: E402
from shoot4fun_backend.domain.model.vec3 import Vec3  # noqa: E402

OUTPUT = _ROOT.parent / "shared" / "movement_trace.json"
TICK = 1.0 / 60.0


@dataclass
class Case:
    name: str
    why: str
    arena: dict
    start: dict
    frames: list[dict] = field(default_factory=list)
    expected: list[dict] = field(default_factory=list)


def _frame(
    dt: float = TICK,
    yaw: float = 0.0,
    forward: bool = False,
    back: bool = False,
    left: bool = False,
    right: bool = False,
    jump: bool = False,
    crouch: bool = False,
) -> dict:
    return {
        "dt": dt,
        "yaw": yaw,
        "forward": forward,
        "back": back,
        "left": left,
        "right": right,
        "jump": jump,
        "crouch": crouch,
    }


def _case(name: str, why: str, arena_id: str, start: Vec3, frames: list[dict]) -> Case:
    arena = DEFAULT_ARENAS[arena_id]
    state = MoveState(start, 0.0)
    expected: list[dict] = []
    for raw in frames:
        state = step(
            state,
            InputFrame(
                seq=0,
                dt=raw["dt"],
                yaw=raw["yaw"],
                forward=raw["forward"],
                back=raw["back"],
                left=raw["left"],
                right=raw["right"],
                jump=raw["jump"],
                crouch=raw["crouch"],
            ),
            arena,
        )
        expected.append(state.position.to_dict())
    # The arena travels inside the case, so the fixture is self-contained
    # and neither suite needs its own copy of the map table.
    return Case(
        name=name,
        why=why,
        arena=arena.to_dict(),
        start=start.to_dict(),
        frames=frames,
        expected=expected,
    )


def build_cases() -> list[Case]:
    cases: list[Case] = []

    cases.append(
        _case(
            "forward_on_open_ground",
            "One second of forward travel is exactly the speed constant.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(forward=True) for _ in range(60)],
        )
    )

    cases.append(
        _case(
            "diagonal_is_not_faster",
            "Forward and strafe together normalise; diagonals do not sprint.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(forward=True, right=True) for _ in range(60)],
        )
    )

    cases.append(
        _case(
            "turning_while_moving",
            "Yaw changes mid-run; the direction follows the look each frame.",
            "sandbox",
            Vec3(0.0, 0.0, 20.0),
            [_frame(forward=True, yaw=i * 0.02) for i in range(90)],
        )
    )

    cases.append(
        _case(
            "runs_into_the_arena_wall",
            "The bounds clamp holds at the edge and does not creep past it.",
            "sandbox",
            Vec3(20.0, 0.0, 25.0),
            [_frame(back=True) for _ in range(120)],
        )
    )

    cases.append(
        _case(
            "slides_along_centre_cover",
            "Walking into the central pillar stops, then slides along it.",
            "sandbox",
            Vec3(0.0, 0.0, 6.0),
            [_frame(forward=True) for _ in range(60)]
            + [_frame(forward=True, right=True) for _ in range(60)],
        )
    )

    cases.append(
        _case(
            "long_frame_is_clamped",
            "A frame claiming a huge dt travels the clamp, not the claim.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(dt=9_999.0, forward=True) for _ in range(3)],
        )
    )

    cases.append(
        _case(
            "idle_and_zero_dt_do_not_move",
            "No buttons, and a zero-length frame, are both no-ops.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(), _frame(dt=0.0, forward=True), _frame(dt=-1.0, forward=True)],
        )
    )

    cases.append(
        _case(
            "atrium_long_wall",
            "The second arena's long central wall resolves the same way.",
            "atrium",
            Vec3(0.0, 0.0, 6.0),
            [_frame(forward=True) for _ in range(90)],
        )
    )

    cases.append(
        _case(
            "jump_rises_and_lands",
            "A single jump arcs up under gravity and settles back on the "
            "ground; y is the vertical simulation, x and z do not move.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(jump=True)] + [_frame() for _ in range(60)],
        )
    )

    cases.append(
        _case(
            "jump_while_running_keeps_the_ground_speed",
            "Jumping mid-run arcs in y while x and z carry on at the walk "
            "speed: vertical and horizontal are independent.",
            "sandbox",
            Vec3(0.0, 0.0, 20.0),
            [_frame(forward=True, jump=True)] + [_frame(forward=True) for _ in range(50)],
        )
    )

    cases.append(
        _case(
            "held_jump_bounces_and_never_sinks",
            "Holding jump re-fires on every grounded frame (the routine "
            "keeps no key edge); the player bounces and y never goes below "
            "the ground.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(jump=True) for _ in range(90)],
        )
    )

    cases.append(
        _case(
            "crouch_walks_at_half_speed",
            "Crouch-walking covers half the ground a stand-walk would over "
            "the same frames, and stays planted on the floor.",
            "sandbox",
            Vec3(0.0, 0.0, 20.0),
            [_frame(forward=True, crouch=True) for _ in range(60)],
        )
    )

    cases.append(
        _case(
            "crouch_suppresses_the_jump",
            "Holding crouch and jump together keeps the player down: a "
            "duck never launches.",
            "sandbox",
            Vec3(20.0, 0.0, 10.0),
            [_frame(jump=True, crouch=True) for _ in range(30)],
        )
    )

    return cases


def main() -> None:
    document = {
        "generated_from": "backend/shoot4fun_backend/domain/model/movement.py",
        "regenerate_with": "python backend/scripts/generate_movement_trace.py",
        "epsilon": 1e-9,
        "cases": [asdict(c) for c in build_cases()],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(document, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )
    steps = sum(len(c.frames) for c in build_cases())
    print(f"wrote {OUTPUT} ({len(document['cases'])} cases, {steps} steps)")


if __name__ == "__main__":
    main()
