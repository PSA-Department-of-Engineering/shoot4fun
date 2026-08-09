/* The haptics engine's contract: it buzzes the three cues when the
 * `sf_haptics` preference is on, stays silent when it is off or the
 * Vibration API is absent, and follows a live toggle through the same
 * `storage` event the settings panel dispatches.
 *
 * The vitest environment is `node`, so `window` and `navigator` are
 * stubbed per test rather than provided by a DOM.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { HapticsEngine } from "./HapticsEngine";

type StorageListener = (event: { key: string | null }) => void;

function stubEnv(stored: string | null) {
    const store = new Map<string, string>();
    if (stored !== null) store.set("sf_haptics", stored);
    const listeners: StorageListener[] = [];
    const vibrate = vi.fn((_pattern: number | number[]) => true);

    vi.stubGlobal("window", {
        localStorage: {
            getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
            setItem: (key: string, value: string) => store.set(key, value),
        },
        addEventListener: (type: string, cb: StorageListener) => {
            if (type === "storage") listeners.push(cb);
        },
    });
    vi.stubGlobal("navigator", { vibrate });

    return {
        vibrate,
        /** Emulate the settings panel flipping the switch. */
        setPref(value: string) {
            store.set("sf_haptics", value);
            for (const cb of listeners) cb({ key: "sf_haptics" });
        },
    };
}

afterEach(() => vi.unstubAllGlobals());

describe("HapticsEngine", () => {
    it("buzzes on fire when the preference is absent (default-on)", () => {
        const { vibrate } = stubEnv(null);
        new HapticsEngine().fire();
        expect(vibrate).toHaveBeenCalledTimes(1);
    });

    it("stays silent for every cue when the preference is off", () => {
        const { vibrate } = stubEnv("0");
        const h = new HapticsEngine();
        h.fire();
        h.hit();
        h.hurt();
        expect(vibrate).not.toHaveBeenCalled();
    });

    it("gives the three cues distinct pulse lengths", () => {
        const { vibrate } = stubEnv("1");
        const h = new HapticsEngine();
        h.fire();
        h.hit();
        h.hurt();
        const patterns = vibrate.mock.calls.map((call) => call[0]);
        expect(new Set(patterns).size).toBe(3);
    });

    it("is a no-op where the Vibration API is absent", () => {
        stubEnv("1");
        vi.stubGlobal("navigator", {}); // desktop: no vibrate
        expect(() => new HapticsEngine().fire()).not.toThrow();
    });

    it("follows a live toggle through the storage event", () => {
        const env = stubEnv("1");
        const h = new HapticsEngine();
        h.fire();
        expect(env.vibrate).toHaveBeenCalledTimes(1);

        env.setPref("0");
        h.fire();
        expect(env.vibrate).toHaveBeenCalledTimes(1);

        env.setPref("1");
        h.fire();
        expect(env.vibrate).toHaveBeenCalledTimes(2);
    });
});
