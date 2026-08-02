/* Why a long render frame is sliced before it is simulated.
 *
 * `movement.step` clamps any frame to MAX_FRAME_DT so a client cannot
 * buy distance by claiming a long one. The consequence, which is easy
 * to miss because the clamp itself is correct, is that a frame LONGER
 * than the ceiling travels only the ceiling's worth of ground. Walking
 * speed then becomes a function of frame rate: a machine rendering at
 * 10fps walks at half pace, and one on software rendering barely moves
 * at all.
 *
 * SceneApp therefore splits a render frame into slices no longer than
 * the ceiling and sends each as its own input. These assert the
 * property that makes that necessary, and the property that makes it
 * safe: slicing recovers exactly the distance the clamp swallowed, and
 * never more than the elapsed time is worth.
 *
 * The guard that actually stops a cheat is the server's real-time
 * budget (`Player.grant_simulation_time`), not this ceiling, which is
 * why slicing costs nothing in cheat resistance.
 */
import { describe, expect, it } from "vitest";

import { MAX_FRAME_DT, MOVE_SPEED, step, type ArenaLike, type MoveIntent } from "./movement";

const OPEN_GROUND: ArenaLike = {
    bounds_min: { x: -100, y: 0, z: -100 },
    bounds_max: { x: 100, y: 0, z: 100 },
    cover: [],
};

const START = { x: 0, y: 0, z: 0 };

function walking(dt: number): MoveIntent {
    return { dt, yaw: 0, forward: true, back: false, left: false, right: false };
}

/** Travel from walking forward for `seconds`, delivered in `slices`. */
function travel(seconds: number, slices: number): number {
    let position = START;
    for (let i = 0; i < slices; i++) {
        position = step(position, walking(seconds / slices), OPEN_GROUND);
    }
    return Math.abs(position.z - START.z);
}

describe("a render frame longer than the simulation ceiling", () => {
    it("travels only the ceiling's worth of ground when sent whole", () => {
        const longFrame = MAX_FRAME_DT * 4;
        expect(travel(longFrame, 1)).toBeCloseTo(MOVE_SPEED * MAX_FRAME_DT, 9);
    });

    it("travels the whole elapsed time's worth when sliced", () => {
        const longFrame = MAX_FRAME_DT * 4;
        expect(travel(longFrame, 4)).toBeCloseTo(MOVE_SPEED * longFrame, 9);
    });

    it("costs a slow client its speed if the frame is not sliced", () => {
        // A tenth of a second per frame is 10fps: playable-looking, and
        // silently half speed against anyone rendering faster.
        const whole = travel(0.1, 1);
        const sliced = travel(0.1, 2);
        expect(whole).toBeLessThan(sliced);
        expect(sliced / whole).toBeCloseTo(2, 6);
    });

    it("gives a sliced frame no more than the elapsed time is worth", () => {
        // Slicing recovers what the clamp swallowed. It does not become
        // a way to travel further than the wall clock allows, which is
        // what would make it a cheat rather than a fix.
        const elapsed = MAX_FRAME_DT * 3;
        for (const slices of [3, 6, 12, 60]) {
            expect(travel(elapsed, slices)).toBeCloseTo(MOVE_SPEED * elapsed, 9);
        }
    });

    it("still moves a frame shorter than the ceiling by its own length", () => {
        const short = MAX_FRAME_DT / 3;
        expect(travel(short, 1)).toBeCloseTo(MOVE_SPEED * short, 9);
    });
});
