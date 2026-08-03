/* The profile viewmodel's derivations (issue #12), pure so they run
 * under node.
 */

import { describe, expect, it } from "vitest";

import { isUsernameValid, selectIsAdopted } from "./profile.model";
import type { ProfileState } from "./profile.state";

describe("isUsernameValid", () => {
    it("accepts a non-blank username", () => {
        expect(isUsernameValid("sniper")).toBe(true);
        expect(isUsernameValid("  sniper  ")).toBe(true);
    });

    it("refuses blank and over-long usernames", () => {
        expect(isUsernameValid("")).toBe(false);
        expect(isUsernameValid("   ")).toBe(false);
        expect(isUsernameValid("x".repeat(33))).toBe(false);
    });

    it("accepts exactly the maximum length", () => {
        expect(isUsernameValid("x".repeat(32))).toBe(true);
    });
});

describe("selectIsAdopted", () => {
    function state(over: Partial<ProfileState> = {}): ProfileState {
        return {
            username: null,
            displayName: "",
            status: "guest",
            error: null,
            ...over,
        };
    }

    it("is false while the profile has not loaded", () => {
        expect(selectIsAdopted(state({ status: "loading" }))).toBe(false);
        expect(selectIsAdopted(state({ status: "error" }))).toBe(false);
        expect(selectIsAdopted(state())).toBe(false);
    });

    it("is true only when a username is actually held", () => {
        expect(selectIsAdopted(state({ status: "ready", username: "sniper" }))).toBe(
            true,
        );
        expect(selectIsAdopted(state({ status: "ready", username: null }))).toBe(false);
    });
});
