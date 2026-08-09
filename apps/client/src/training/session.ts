/* The solo aim-training session (issue #15).
 *
 * A framework-free model of one Aim-Lab-style practice round: a bounded
 * field holds a fixed number of shootable targets, the player fires at
 * them, and every shot is scored the instant it lands. Nothing here
 * knows about Three.js, the DOM or the network — the scene mirrors the
 * targets this owns onto meshes and hands back which one a ray struck,
 * and this decides what that meant. Keeping the rules here rather than
 * in the render loop is what lets them be tested at all: the loop draws,
 * this counts.
 *
 * The whole round runs on the client. The multiplayer game is
 * server-authoritative (ADR-0003), but a solo range has no opponent to
 * be fair to and no round for the match state machine to own, so the
 * targets are spawned, moved and scored here and never travel the wire.
 *
 * Randomness is injected so a test can pin every spawn. A session handed
 * a deterministic `rng` lays its targets out the same way every run.
 */

/** The three ways a target behaves once it is in the field. */
export type TargetKind = "static" | "moving" | "popup";

/** One target, as both this model and the scene that draws it see it.
 * The `id` is the handle the two share: the scene tags each mesh with
 * it, and a hit is reported back by it. */
export interface Target {
    readonly id: number;
    readonly kind: TargetKind;
    x: number;
    y: number;
    z: number;
    readonly radius: number;
    /** Horizontal velocity in metres per second; zero for a target that
     * does not move. Only the ground plane is travelled, so there is no
     * vertical component. */
    vx: number;
    vz: number;
    /** Milliseconds a popup target has left before it vanishes and is
     * replaced elsewhere. `Infinity` for a target that never times out. */
    ttlMs: number;
}

/** The rectangle on the ground a target centre may sit within, already
 * inset from the arena walls by whoever built the config. */
export interface FieldBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface TrainingConfig {
    /** Where target centres may fall on the ground plane. */
    bounds: FieldBounds;
    /** The band of heights a target centre may sit at above the floor. */
    minHeight: number;
    maxHeight: number;
    /** Every target is a sphere of this radius. */
    targetRadius: number;
    /** How many live targets the field is kept topped up to. */
    targetCount: number;
    /** Fraction of spawns that drift across the field (`moving`). */
    movingFraction: number;
    /** Fraction of spawns that time out and relocate (`popup`). The rest
     * are `static`. `movingFraction + popupFraction` must not exceed 1. */
    popupFraction: number;
    /** Speed of a moving target, metres per second. */
    moveSpeed: number;
    /** How long a popup target lives before it relocates, milliseconds. */
    popupLifetimeMs: number;
    /** The round's length, milliseconds. */
    durationMs: number;
    /** Points a bare hit is worth, before the streak bonus. */
    hitScore: number;
    /** Extra points per hit for each consecutive hit past the first. */
    streakBonus: number;
}

/** Live counters, read by the HUD every frame. */
export interface SessionStats {
    hits: number;
    misses: number;
    shots: number;
    /** Hits over shots, in `[0, 1]`; zero before the first shot. */
    accuracy: number;
    score: number;
    /** The current unbroken run of hits. */
    streak: number;
    bestStreak: number;
    elapsedMs: number;
    remainingMs: number;
}

/** The card shown when the round is over. */
export interface SessionTally {
    hits: number;
    misses: number;
    shots: number;
    accuracy: number;
    score: number;
    bestStreak: number;
    durationMs: number;
}

/** A sensible default range: a 24m room's worth of field, inset from the
 * walls, kept at six targets with a moving quarter and a popup quarter. */
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
    bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 6 },
    minHeight: 1.0,
    maxHeight: 2.4,
    targetRadius: 0.45,
    targetCount: 6,
    movingFraction: 0.25,
    popupFraction: 0.25,
    moveSpeed: 2.2,
    popupLifetimeMs: 3200,
    durationMs: 60_000,
    hitScore: 100,
    streakBonus: 10,
};

type Rng = () => number;

export class TrainingSession {
    private readonly config: TrainingConfig;
    private readonly rng: Rng;
    private readonly _targets: Target[] = [];
    private nextId = 1;

    private _hits = 0;
    private _misses = 0;
    private _shots = 0;
    private _score = 0;
    private _streak = 0;
    private _bestStreak = 0;
    private _elapsedMs = 0;
    private _ended = false;

    constructor(config: TrainingConfig = DEFAULT_TRAINING_CONFIG, rng: Rng = Math.random) {
        this.config = config;
        this.rng = rng;
        this.refill();
    }

    /** The live targets, for the scene to mirror onto meshes by `id`. */
    targets(): readonly Target[] {
        return this._targets;
    }

    isEnded(): boolean {
        return this._ended;
    }

    /* Advance the world by one frame. Moving targets drift and bounce off
     * the field edges, popup targets age out and are replaced elsewhere,
     * and the clock runs the round down. A dt is clamped low so a tab
     * that was backgrounded for a second does not teleport every moving
     * target across the room on the frame it returns. */
    tick(dtMs: number): void {
        if (this._ended || dtMs <= 0) return;
        const dt = Math.min(dtMs, 100);
        this._elapsedMs += dtMs;

        const { bounds, targetRadius } = this.config;
        const minX = bounds.minX + targetRadius;
        const maxX = bounds.maxX - targetRadius;
        const minZ = bounds.minZ + targetRadius;
        const maxZ = bounds.maxZ - targetRadius;
        const seconds = dt / 1000;

        for (let i = this._targets.length - 1; i >= 0; i--) {
            const target = this._targets[i];
            if (target.vx !== 0 || target.vz !== 0) {
                target.x += target.vx * seconds;
                target.z += target.vz * seconds;
                // Reflect off the field edge so a moving target stays in
                // play rather than sailing into a wall.
                if (target.x <= minX) {
                    target.x = minX;
                    target.vx = Math.abs(target.vx);
                } else if (target.x >= maxX) {
                    target.x = maxX;
                    target.vx = -Math.abs(target.vx);
                }
                if (target.z <= minZ) {
                    target.z = minZ;
                    target.vz = Math.abs(target.vz);
                } else if (target.z >= maxZ) {
                    target.z = maxZ;
                    target.vz = -Math.abs(target.vz);
                }
            }
            if (Number.isFinite(target.ttlMs)) {
                target.ttlMs -= dtMs;
                if (target.ttlMs <= 0) {
                    // A popup the player let expire is not a miss — a miss
                    // is a shot that hit nothing — it simply moves on.
                    this._targets.splice(i, 1);
                }
            }
        }

        this.refill();
        if (this._elapsedMs >= this.config.durationMs) this.end();
    }

    /* One shot resolved. `hitId` is the target a ray struck, or `null`
     * for a shot that found only the room. A hit banks its score, extends
     * the streak, clears the struck target and spawns a fresh one; a miss
     * breaks the streak. Firing after time is up scores nothing. */
    registerShot(hitId: number | null): void {
        if (this._ended) return;
        this._shots += 1;
        const index =
            hitId === null ? -1 : this._targets.findIndex((t) => t.id === hitId);
        if (index === -1) {
            this._misses += 1;
            this._streak = 0;
            return;
        }
        this._hits += 1;
        this._streak += 1;
        if (this._streak > this._bestStreak) this._bestStreak = this._streak;
        this._score +=
            this.config.hitScore + this.config.streakBonus * (this._streak - 1);
        this._targets.splice(index, 1);
        this.refill();
    }

    stats(): SessionStats {
        return {
            hits: this._hits,
            misses: this._misses,
            shots: this._shots,
            accuracy: this._shots === 0 ? 0 : this._hits / this._shots,
            score: this._score,
            streak: this._streak,
            bestStreak: this._bestStreak,
            elapsedMs: this._elapsedMs,
            remainingMs: Math.max(0, this.config.durationMs - this._elapsedMs),
        };
    }

    /** End the round now and read the final card. Idempotent, so the
     * clock running out and the player quitting early land the same. */
    end(): SessionTally {
        this._ended = true;
        this._targets.length = 0;
        return {
            hits: this._hits,
            misses: this._misses,
            shots: this._shots,
            accuracy: this._shots === 0 ? 0 : this._hits / this._shots,
            score: this._score,
            bestStreak: this._bestStreak,
            durationMs: Math.min(this._elapsedMs, this.config.durationMs),
        };
    }

    /** Top the field back up to `targetCount` after hits and expiries. */
    private refill(): void {
        while (this._targets.length < this.config.targetCount) {
            this._targets.push(this.spawn());
        }
    }

    private spawn(): Target {
        const { bounds, targetRadius, minHeight, maxHeight, moveSpeed } = this.config;
        const x = this.between(bounds.minX + targetRadius, bounds.maxX - targetRadius);
        const z = this.between(bounds.minZ + targetRadius, bounds.maxZ - targetRadius);
        const y = this.between(minHeight, maxHeight);
        const kind = this.rollKind();

        let vx = 0;
        let vz = 0;
        if (kind === "moving") {
            // A heading on the ground plane at the configured speed.
            const angle = this.rng() * Math.PI * 2;
            vx = Math.cos(angle) * moveSpeed;
            vz = Math.sin(angle) * moveSpeed;
        }
        const ttlMs = kind === "popup" ? this.config.popupLifetimeMs : Infinity;

        return { id: this.nextId++, kind, x, y, z, radius: targetRadius, vx, vz, ttlMs };
    }

    private rollKind(): TargetKind {
        const roll = this.rng();
        if (roll < this.config.movingFraction) return "moving";
        if (roll < this.config.movingFraction + this.config.popupFraction) return "popup";
        return "static";
    }

    private between(lo: number, hi: number): number {
        if (hi <= lo) return lo;
        return lo + this.rng() * (hi - lo);
    }
}
