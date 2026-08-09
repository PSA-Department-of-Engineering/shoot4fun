/* The two pure decisions of the touch channel (issue #17): which devices
 * get the touch layout, and how a stick vector becomes held directions.
 * The live overlay's DOM plumbing is exercised by the e2e suite; these
 * are the parts that answer the same way with no browser at all.
 */

import { describe, expect, it } from "vitest";

import { STICK_DEADZONE, decideTouch, stickToButtons } from "./touch";

describe("decideTouch", () => {
    it("is a touch device only with a coarse pointer AND a touch point", () => {
        expect(decideTouch(true, 5)).toBe(true);
        expect(decideTouch(true, 1)).toBe(true);
    });

    it("rejects a touchscreen laptop: touch points but a fine mouse", () => {
        // Coarse is false because the primary pointer is the mouse; the
        // machine keeps the pointer-lock layout it can drive.
        expect(decideTouch(false, 10)).toBe(false);
    });

    it("rejects a plain desktop: no coarse pointer, no touch points", () => {
        expect(decideTouch(false, 0)).toBe(false);
    });

    it("rejects a coarse claim with no touch points", () => {
        expect(decideTouch(true, 0)).toBe(false);
    });
});

describe("stickToButtons", () => {
    it("resting at centre holds nothing", () => {
        expect(stickToButtons(0, 0)).toEqual({
            forward: false,
            back: false,
            left: false,
            right: false,
        });
    });

    it("stays still inside the deadzone", () => {
        const inside = STICK_DEADZONE - 0.05;
        expect(stickToButtons(inside, inside)).toEqual({
            forward: false,
            back: false,
            left: false,
            right: false,
        });
    });

    it("pushing forward walks forward and nothing else", () => {
        expect(stickToButtons(0, 1)).toEqual({
            forward: true,
            back: false,
            left: false,
            right: false,
        });
    });

    it("pulling back walks back", () => {
        expect(stickToButtons(0, -1)).toMatchObject({ forward: false, back: true });
    });

    it("a diagonal lights two directions, like W+D", () => {
        expect(stickToButtons(1, 1)).toEqual({
            forward: true,
            back: false,
            left: false,
            right: true,
        });
    });

    it("the sign of each axis picks the direction", () => {
        expect(stickToButtons(-1, -1)).toEqual({
            forward: false,
            back: true,
            left: true,
            right: false,
        });
    });
});
