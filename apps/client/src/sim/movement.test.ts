/* The client half of the shared-trace gate (ADR-0004).
 *
 * `shared/movement_trace.json` is generated from the server's movement
 * routine, which is the authority. This replays every case through the
 * client's routine and asserts each step agrees. The server suite
 * replays the same file, so the two implementations cannot drift
 * without both builds failing and naming the first differing step.
 *
 * A failure here means one of three things: the client routine changed,
 * the server routine changed without the trace being regenerated, or
 * the two runtimes disagree on floating point beyond the epsilon.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { step, type ArenaLike, type MoveIntent, type MoveState, type Vec3Like } from "./movement";

interface TraceCase {
    name: string;
    why: string;
    arena: ArenaLike;
    start: Vec3Like;
    frames: MoveIntent[];
    expected: Vec3Like[];
}

interface Trace {
    generated_from: string;
    regenerate_with: string;
    epsilon: number;
    cases: TraceCase[];
}

const here = dirname(fileURLToPath(import.meta.url));
const tracePath = resolve(here, "../../../../shared/movement_trace.json");
const trace = JSON.parse(readFileSync(tracePath, "utf-8")) as Trace;

describe("movement agrees with the server's authoritative routine", () => {
    it("ships a trace with cases in it", () => {
        expect(trace.cases.length).toBeGreaterThan(0);
    });

    for (const testCase of trace.cases) {
        it(`${testCase.name}: ${testCase.why}`, () => {
            let state: MoveState = { position: testCase.start, vy: 0 };
            for (let i = 0; i < testCase.frames.length; i++) {
                state = step(state, testCase.frames[i], testCase.arena);
                const position = state.position;
                const want = testCase.expected[i];
                // Reported per step rather than only at the end, so a
                // divergence names the frame it began on. y is the
                // jump/crouch axis (issue #10), pinned like x and z.
                for (const axis of ["x", "y", "z"] as const) {
                    expect(
                        Math.abs(position[axis] - want[axis]),
                        `${axis} diverged at step ${i} (got ${position[axis]}, want ${want[axis]}). ` +
                            `If the server routine changed, run: ${trace.regenerate_with}`,
                    ).toBeLessThanOrEqual(trace.epsilon);
                }
            }
        });
    }
});
