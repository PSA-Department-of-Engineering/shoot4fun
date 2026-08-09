/* Touch input, the mobile half of the controls (issue #17).
 *
 * The desktop game is gated on pointer lock: relative mouse deltas walk
 * the look, WASD walks the feet, and neither exists on a phone. A finger
 * has no lock to take and no keys to hold, so mobile play needs its own
 * input channel - an on-screen stick, a look pad, and buttons - feeding
 * the same `InputController` state the keyboard and mouse feed.
 *
 * Two decisions in that channel are pure and worth pinning on their own,
 * away from the DOM the live overlay needs: which devices get the touch
 * layout at all, and how a stick's analog vector becomes the four held
 * booleans the movement routine already speaks. Both live here as plain
 * functions the unit tests exercise directly; `isTouchDevice` reads the
 * browser and delegates to the first.
 */

/** The movement intent a stick resolves to: the same four booleans the
 * keyboard sets, so nothing downstream has to learn a new shape. */
export interface MoveButtons {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
}

/** How far the thumb must leave the stick's centre before it counts as a
 * direction, as a fraction of the stick's radius. A resting thumb wanders
 * a pixel or two; without a deadzone that drifts the player into a wall. */
export const STICK_DEADZONE = 0.3;

/* A phone or tablet reports a coarse primary pointer AND at least one
 * touch point. Either signal alone is a false positive on the machines
 * that matter: a touchscreen laptop has a fine mouse as its primary
 * pointer (coarse is false) yet a non-zero `maxTouchPoints`, and it must
 * keep the pointer-lock layout it can actually drive. Requiring both
 * keeps the touch layout on the devices that have only a finger. */
export function decideTouch(coarsePointer: boolean, touchPoints: number): boolean {
    return coarsePointer && touchPoints > 0;
}

/** True when this device has only a finger to play with: no mouse to
 * lock, no keyboard to walk with, so it gets the touch layout. */
export function isTouchDevice(): boolean {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const touchPoints =
        typeof navigator === "undefined" ? 0 : (navigator.maxTouchPoints ?? 0);
    return decideTouch(coarse, touchPoints);
}

/* Map a stick vector to the four booleans. `x` is right-positive and `y`
 * is forward-positive, each already normalised to [-1, 1] against the
 * stick's radius. Opposite directions are mutually exclusive by the sign
 * of each axis, so a diagonal lights two of the four - exactly what
 * holding W and D together does on a keyboard. */
export function stickToButtons(
    x: number,
    y: number,
    deadzone: number = STICK_DEADZONE,
): MoveButtons {
    return {
        forward: y > deadzone,
        back: y < -deadzone,
        right: x > deadzone,
        left: x < -deadzone,
    };
}
