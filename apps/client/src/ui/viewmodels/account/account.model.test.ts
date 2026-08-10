import { describe, expect, it } from "vitest";

import { isDisplayNameValid } from "./account.model";

/* The client's only rule about a display name. It exists so the Save button
 * can be disabled rather than to be the check that matters: the server
 * normalises and re-validates, because a rule enforced only in the client is
 * not enforced. */
describe("isDisplayNameValid", () => {
    it("accepts an ordinary name", () => {
        expect(isDisplayNameValid("AimBotanist")).toBe(true);
        expect(isDisplayNameValid("Cool Guy")).toBe(true);
        expect(isDisplayNameValid("a_b-c.d")).toBe(true);
    });

    it("accepts letters outside ASCII", () => {
        // The server's rule is letters and numbers, not the Latin alphabet.
        expect(isDisplayNameValid("Renée")).toBe(true);
        expect(isDisplayNameValid("玩家一")).toBe(true);
    });

    it("rejects a name that is too short or too long", () => {
        expect(isDisplayNameValid("a")).toBe(false);
        expect(isDisplayNameValid("x".repeat(25))).toBe(false);
        expect(isDisplayNameValid("x".repeat(24))).toBe(true);
    });

    it("rejects whitespace-only and measures the collapsed form", () => {
        expect(isDisplayNameValid("   ")).toBe(false);
        // Collapsing runs is the server's normalisation, so the client has to
        // measure the same string the server will, or the button lies.
        expect(isDisplayNameValid("  Cool    Guy  ")).toBe(true);
    });

    it("rejects punctuation the server would refuse", () => {
        expect(isDisplayNameValid("drop;table")).toBe(false);
        expect(isDisplayNameValid("<script>")).toBe(false);
        expect(isDisplayNameValid("a@b")).toBe(false);
    });
});
