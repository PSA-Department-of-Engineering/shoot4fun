/* The match clock reads by whole seconds and never a tick early.
 *
 * The one risk in a countdown is that it shows 0:00 while the match is still
 * live, or hangs a second past the deadline; every case here pins the second
 * the clock is inside.
 */

import { describe, expect, it } from "vitest";

import { formatClock } from "./clock";

describe("formatClock", () => {
    it("formats a full match as minutes and zero-padded seconds", () => {
        expect(formatClock(480)).toBe("8:00");
    });

    it("pads the seconds under ten", () => {
        expect(formatClock(65)).toBe("1:05");
        expect(formatClock(9)).toBe("0:09");
    });

    it("counts by the second it is inside, reaching 0:00 only at zero", () => {
        expect(formatClock(0.4)).toBe("0:01");
        expect(formatClock(0)).toBe("0:00");
    });

    it("clamps a past-deadline snapshot to zero", () => {
        expect(formatClock(-3)).toBe("0:00");
    });
});
