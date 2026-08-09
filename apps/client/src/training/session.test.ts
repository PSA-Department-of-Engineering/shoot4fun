/* The solo training session's rules, pinned with a deterministic rng
 * (issue #15).
 *
 * The scene draws the targets and reports which one a ray struck; every
 * judgement about what that shot was worth lives in `TrainingSession`,
 * so this is where that judgement is held to account. The rng is
 * injected, so a spawn's kind and place are known and a test can name a
 * target it means to hit.
 */

import { describe, expect, it } from "vitest";

import {
    DEFAULT_TRAINING_CONFIG,
    TrainingSession,
    type TrainingConfig,
} from "./session";

/* An rng that walks a fixed list and then holds its last value, so a
 * test controls exactly which branch every `spawn()` takes. */
function scriptedRng(values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

/* A config with no moving and no popup targets, so every spawn is a
 * static one that stays where it was put: the shape most assertions
 * about scoring want, uncomplicated by drift or expiry. */
function staticConfig(overrides: Partial<TrainingConfig> = {}): TrainingConfig {
    return {
        ...DEFAULT_TRAINING_CONFIG,
        movingFraction: 0,
        popupFraction: 0,
        targetCount: 3,
        ...overrides,
    };
}

describe("TrainingSession spawning", () => {
    it("fills the field to targetCount on construction", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 5 }));
        expect(session.targets()).toHaveLength(5);
    });

    it("gives every target a distinct id", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 4 }));
        const ids = session.targets().map((t) => t.id);
        expect(new Set(ids).size).toBe(4);
    });

    it("spawns every target within the inset field bounds", () => {
        const config = staticConfig({ targetCount: 8 });
        // A spread of rng values so the spawns land across the field
        // rather than all in one spot.
        const session = new TrainingSession(config, scriptedRng([0.05, 0.5, 0.95, 0.2, 0.8, 0.35, 0.65, 0.1]));
        const r = config.targetRadius;
        for (const t of session.targets()) {
            expect(t.x).toBeGreaterThanOrEqual(config.bounds.minX + r);
            expect(t.x).toBeLessThanOrEqual(config.bounds.maxX - r);
            expect(t.z).toBeGreaterThanOrEqual(config.bounds.minZ + r);
            expect(t.z).toBeLessThanOrEqual(config.bounds.maxZ - r);
            expect(t.y).toBeGreaterThanOrEqual(config.minHeight);
            expect(t.y).toBeLessThanOrEqual(config.maxHeight);
        }
    });

    it("reads the target's kind off the rng roll", () => {
        // spawn() draws x, z and y first, so the fourth rng value is the
        // kind roll: below movingFraction is moving, below moving+popup
        // is popup, above is static.
        const config: TrainingConfig = {
            ...DEFAULT_TRAINING_CONFIG,
            movingFraction: 0.25,
            popupFraction: 0.25,
            targetCount: 1,
        };
        expect(new TrainingSession(config, scriptedRng([0.5, 0.5, 0.5, 0.1])).targets()[0].kind).toBe("moving");
        expect(new TrainingSession(config, scriptedRng([0.5, 0.5, 0.5, 0.4])).targets()[0].kind).toBe("popup");
        expect(new TrainingSession(config, scriptedRng([0.5, 0.5, 0.5, 0.9])).targets()[0].kind).toBe("static");
    });

    it("gives a moving target the configured speed and no vertical drift", () => {
        const config: TrainingConfig = {
            ...DEFAULT_TRAINING_CONFIG,
            movingFraction: 1,
            popupFraction: 0,
            moveSpeed: 3,
            targetCount: 1,
        };
        const target = new TrainingSession(config, scriptedRng([0, 0.5, 0.5])).targets()[0];
        expect(Math.hypot(target.vx, target.vz)).toBeCloseTo(3, 6);
    });
});

describe("TrainingSession scoring", () => {
    it("banks a hit, extends the streak and replaces the target", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3, hitScore: 100, streakBonus: 10 }));
        const first = session.targets()[0].id;
        session.registerShot(first);

        const stats = session.stats();
        expect(stats.hits).toBe(1);
        expect(stats.shots).toBe(1);
        expect(stats.streak).toBe(1);
        expect(stats.score).toBe(100); // first hit: no streak bonus yet
        // The struck target is gone and the field is topped back up.
        expect(session.targets().some((t) => t.id === first)).toBe(false);
        expect(session.targets()).toHaveLength(3);
    });

    it("adds the streak bonus for each consecutive hit", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3, hitScore: 100, streakBonus: 10 }));
        session.registerShot(session.targets()[0].id); // +100 (streak 1)
        session.registerShot(session.targets()[0].id); // +110 (streak 2)
        session.registerShot(session.targets()[0].id); // +120 (streak 3)
        const stats = session.stats();
        expect(stats.score).toBe(330);
        expect(stats.bestStreak).toBe(3);
    });

    it("counts a miss and breaks the streak without spending a target", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3 }));
        session.registerShot(session.targets()[0].id); // hit, streak 1
        session.registerShot(null); // miss

        const stats = session.stats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.shots).toBe(2);
        expect(stats.streak).toBe(0);
        expect(stats.bestStreak).toBe(1);
        expect(session.targets()).toHaveLength(3);
    });

    it("treats a shot at an unknown id as a miss", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3 }));
        session.registerShot(999_999);
        expect(session.stats().misses).toBe(1);
        expect(session.stats().hits).toBe(0);
    });

    it("reports accuracy as hits over shots", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3 }));
        expect(session.stats().accuracy).toBe(0); // no shots yet
        session.registerShot(session.targets()[0].id);
        session.registerShot(null);
        expect(session.stats().accuracy).toBeCloseTo(0.5, 6);
    });
});

describe("TrainingSession clock and lifecycle", () => {
    it("moves a moving target and keeps it inside the field", () => {
        const config: TrainingConfig = {
            ...DEFAULT_TRAINING_CONFIG,
            movingFraction: 1,
            popupFraction: 0,
            moveSpeed: 5,
            targetCount: 1,
            durationMs: 1_000_000,
        };
        const session = new TrainingSession(config, scriptedRng([0, 0.9, 0.5]));
        const before = { ...session.targets()[0] };
        // Drive many frames so the target reaches and reflects off an edge.
        for (let i = 0; i < 200; i++) session.tick(16);
        const after = session.targets()[0];
        const r = config.targetRadius;
        expect(after.x).toBeGreaterThanOrEqual(config.bounds.minX + r - 1e-6);
        expect(after.x).toBeLessThanOrEqual(config.bounds.maxX - r + 1e-6);
        expect(after.z).toBeGreaterThanOrEqual(config.bounds.minZ + r - 1e-6);
        expect(after.z).toBeLessThanOrEqual(config.bounds.maxZ - r + 1e-6);
        // It actually travelled.
        expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0);
    });

    it("retires a popup target when its lifetime runs out and refills", () => {
        const config: TrainingConfig = {
            ...DEFAULT_TRAINING_CONFIG,
            movingFraction: 0,
            popupFraction: 1,
            popupLifetimeMs: 500,
            targetCount: 2,
            durationMs: 1_000_000,
        };
        const session = new TrainingSession(config, scriptedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
        const original = session.targets().map((t) => t.id);
        session.tick(600); // past the popup lifetime
        const now = session.targets().map((t) => t.id);
        // Same count, but the timed-out targets were replaced by new ids.
        expect(now).toHaveLength(2);
        expect(now.some((id) => original.includes(id))).toBe(false);
    });

    it("ends when the round's duration elapses and clears the field", () => {
        const session = new TrainingSession(staticConfig({ durationMs: 1_000 }));
        session.tick(400);
        expect(session.isEnded()).toBe(false);
        session.tick(700); // past 1000ms total
        expect(session.isEnded()).toBe(true);
        expect(session.targets()).toHaveLength(0);
    });

    it("scores nothing once the round is over", () => {
        const session = new TrainingSession(staticConfig({ durationMs: 100 }));
        session.tick(200); // ends
        session.registerShot(1);
        expect(session.stats().shots).toBe(0);
    });

    it("end() is idempotent and reports the final card", () => {
        const session = new TrainingSession(staticConfig({ targetCount: 3, durationMs: 1_000 }));
        session.registerShot(session.targets()[0].id);
        session.registerShot(null);
        const first = session.end();
        const second = session.end();
        expect(second).toEqual(first);
        expect(first.hits).toBe(1);
        expect(first.misses).toBe(1);
        expect(first.shots).toBe(2);
        expect(first.accuracy).toBeCloseTo(0.5, 6);
    });
});
