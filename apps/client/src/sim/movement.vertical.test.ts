/* Jump and crouch on the client routine (issue #10).
 *
 * The shared trace already pins these against the server; this states
 * the same behaviour in the client's own terms, so a regression here is
 * legible as a named case and not only as a fixture diff.
 */
import { describe, expect, it } from "vitest";

import {
    CROUCH_SPEED_FACTOR,
    GROUND_Y,
    MOVE_SPEED,
    step,
    type ArenaLike,
    type MoveIntent,
    type MoveState,
} from "./movement";

const OPEN: ArenaLike = {
    bounds_min: { x: -100, y: 0, z: -100 },
    bounds_max: { x: 100, y: 0, z: 100 },
    cover: [],
};

const TICK = 1 / 60;

function intent(over: Partial<MoveIntent>): MoveIntent {
    return {
        dt: TICK,
        yaw: 0,
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        crouch: false,
        ...over,
    };
}

function grounded(): MoveState {
    return { position: { x: 0, y: 0, z: 0 }, vy: 0 };
}

describe("vertical movement", () => {
    it("jumps off the ground with upward velocity", () => {
        const after = step(grounded(), intent({ jump: true }), OPEN);
        expect(after.position.y).toBeGreaterThan(GROUND_Y);
        expect(after.vy).toBeGreaterThan(0);
    });

    it("arcs up and lands back on the ground", () => {
        let state = step(grounded(), intent({ jump: true }), OPEN);
        let peak = state.position.y;
        for (let i = 0; i < 120; i++) {
            state = step(state, intent({}), OPEN);
            peak = Math.max(peak, state.position.y);
        }
        expect(peak).toBeGreaterThan(1.0);
        expect(state.position.y).toBe(GROUND_Y);
        expect(state.vy).toBe(0);
    });

    it("crouch-walks at half the ground speed", () => {
        const stand = step(grounded(), intent({ forward: true }), OPEN);
        const crouch = step(grounded(), intent({ forward: true, crouch: true }), OPEN);
        expect(Math.abs(stand.position.z)).toBeCloseTo(MOVE_SPEED * TICK, 9);
        expect(Math.abs(crouch.position.z)).toBeCloseTo(
            MOVE_SPEED * TICK * CROUCH_SPEED_FACTOR,
            9,
        );
    });

    it("cannot jump while crouched", () => {
        const after = step(grounded(), intent({ jump: true, crouch: true }), OPEN);
        expect(after.position.y).toBe(GROUND_Y);
        expect(after.vy).toBe(0);
    });

    it("never sinks below the ground while jump is held", () => {
        let state = grounded();
        for (let i = 0; i < 180; i++) {
            state = step(state, intent({ jump: true }), OPEN);
            expect(state.position.y).toBeGreaterThanOrEqual(GROUND_Y);
        }
    });
});
