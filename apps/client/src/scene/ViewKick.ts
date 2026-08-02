/* The camera's own reaction: recoil when you fire, a jolt when you are
 * hit.
 *
 * A first-person camera that never moves on its own makes a rifle feel
 * like a mouse click. What sells the weapon is that the view leaves
 * where the player aimed it and comes back: it is the *return* that
 * reads as a gun, so the kick is a damped spring rather than a decay,
 * and the player's own aim is never overwritten. Everything here is an
 * offset added to the look the player is holding, so releasing the
 * trigger leaves the camera exactly where they pointed it.
 *
 * All of it is delta-time integrated, the springs in fixed substeps
 * (see `spring`). A per-frame constant would make the recoil twice as
 * violent on a 120Hz screen as on a 60Hz one.
 *
 * Some people cannot look at a view that moves without being moved. The
 * whole of this module answers `prefers-reduced-motion`: with it set,
 * the camera holds still and the flash, the tracer and the impact carry
 * the shot instead. Reading it live rather than at construction means
 * changing the system setting mid-match takes effect mid-match.
 */

import { Spring } from "./spring";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Stiffness and damping of the spring the view hangs off. Tuned so a
 * shot has visibly settled by the time the next one is allowed. */
const STIFFNESS = 190;
const DAMPING = 21;

/** Radians a shot throws the view up, and sideways at random. */
const RECOIL_PITCH = 0.9;
const RECOIL_YAW = 0.34;

/** How fast trauma bleeds off, per second. */
const TRAUMA_DECAY = 1.9;
const SHAKE_METRES = 0.05;
const SHAKE_RADIANS = 0.02;
/** Prime-ish frequencies, so the three axes never line up into a wobble. */
const SHAKE_HZ = [23.1, 19.7, 17.3];

export class ViewKick {
    private readonly pitch = new Spring(STIFFNESS, DAMPING);
    private readonly yaw = new Spring(STIFFNESS, DAMPING);
    private trauma = 0;
    private elapsed = 0;
    private query: MediaQueryList | null = null;
    private reduced = false;
    private readonly onPreferenceChange = (event: MediaQueryListEvent): void => {
        this.reduced = event.matches;
        if (this.reduced) this.settle();
    };

    constructor() {
        if (typeof window !== "undefined" && window.matchMedia) {
            this.query = window.matchMedia(REDUCED_MOTION);
            this.reduced = this.query.matches;
            this.query.addEventListener("change", this.onPreferenceChange);
        }
    }

    /** One round left the barrel. */
    recoil(): void {
        if (this.reduced) return;
        this.pitch.kick(RECOIL_PITCH);
        this.yaw.kick((Math.random() - 0.5) * 2 * RECOIL_YAW);
    }

    /** Something landed on the player. `severity` is 0 to 1. */
    jolt(severity: number): void {
        if (this.reduced) return;
        this.trauma = Math.min(1, this.trauma + severity);
    }

    update(dt: number): void {
        this.elapsed += dt;
        this.pitch.update(dt);
        this.yaw.update(dt);
        this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);
    }

    /** Radians to add to the player's own pitch this frame. */
    pitchOffset(): number {
        return this.pitch.value + this.shake(0) * SHAKE_RADIANS;
    }

    /** Radians to add to the player's own yaw this frame. */
    yawOffset(): number {
        return this.yaw.value + this.shake(1) * SHAKE_RADIANS;
    }

    /** Roll, which only shake produces: no weapon rolls the view. */
    rollOffset(): number {
        return this.shake(2) * SHAKE_RADIANS;
    }

    /** Sideways displacement of the eye this frame, in metres. */
    shakeX(): number {
        return this.shake(1) * SHAKE_METRES;
    }

    /** Vertical displacement of the eye this frame, in metres. */
    shakeY(): number {
        return this.shake(0) * SHAKE_METRES;
    }

    /** How hard the view is currently being thrown around, 0 to 1. */
    intensity(): number {
        return Math.min(1, Math.abs(this.pitch.value) * 4 + this.trauma);
    }

    /** True when the player has asked for a still camera. */
    get motionReduced(): boolean {
        return this.reduced;
    }

    dispose(): void {
        this.query?.removeEventListener("change", this.onPreferenceChange);
        this.query = null;
        this.settle();
    }

    /* Trauma squared, so a small knock is barely there and a big one is
     * unmistakable, times a wave that never repeats within a burst. */
    private shake(axis: number): number {
        if (this.trauma <= 0) return 0;
        return (
            this.trauma * this.trauma * Math.sin(this.elapsed * SHAKE_HZ[axis] * Math.PI)
        );
    }

    private settle(): void {
        this.pitch.settle();
        this.yaw.settle();
        this.trauma = 0;
    }
}
