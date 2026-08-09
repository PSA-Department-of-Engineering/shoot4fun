/* Mouse and keyboard input for a first-person shooter (ADR-0002).
 *
 * Two things matter here and both were wrong before.
 *
 * First, this is a *state holder*, not a loop. It records what is
 * currently held and how far the mouse has moved; the render loop
 * samples it once per frame. Owning its own `requestAnimationFrame`
 * would put input on a second clock, decoupled from rendering and from
 * the frame's delta time.
 *
 * Second, look is applied locally and immediately. Yaw and pitch never
 * make a round trip before the camera turns: the server is told where
 * the player looked, and decides what that look hit, but it is never
 * asked for permission to turn the camera.
 *
 * Pointer lock is the browser's gate on relative mouse deltas, so it is
 * mandatory for mouse-look and can only be requested from a real user
 * gesture. It can be refused, and the user can drop it at any time with
 * Escape, so the lock has a lifecycle with listeners rather than being
 * assumed once and forgotten.
 *
 * The lock is also what decides whether a keystroke is a movement key at
 * all. Held, the mouse is the game's and WASD walks; released, the player
 * is reading a menu, so the same keys are a name being typed into a field
 * and an arrow walking a radio group. Reading the lock rather than the
 * event's target keeps that rule in one place, here, instead of at every
 * control that would otherwise have to defend itself.
 */

import { stickToButtons } from "./touch";

export interface InputSnapshot {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
    fire: boolean;
    /** Jump and crouch intent (issue #10). Sampled and sent like any
     * other button; the shared movement routine reads them to drive the
     * jump arc and the crouch stance, predicted locally and integrated
     * on the server. */
    jump: boolean;
    crouch: boolean;
    yaw: number;
    pitch: number;
}

export type LockListener = (locked: boolean) => void;

/* The touch layout's channel into this controller (issue #17). A phone
 * has no pointer lock and no keyboard, so the on-screen stick, look pad
 * and buttons drive the same held state the mouse and keys drive - the
 * scene samples one snapshot and never learns where it came from. */
export interface TouchInput {
    /** Set the stick vector: x right-positive, y forward-positive, each
     * normalised to [-1, 1]. Mapped to the four held directions. */
    move(x: number, y: number): void;
    /** Turn the camera from a look-pad drag, in pixels, at the dedicated
     * touch look-sensitivity (issue #34), independent of the mouse dial. */
    look(dx: number, dy: number): void;
    fire(down: boolean): void;
    jump(down: boolean): void;
    crouch(down: boolean): void;
    reload(): void;
    switchWeapon(weapon: string): void;
}

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const DEFAULT_SENSITIVITY = 0.0022;
const SENSITIVITY_KEY = "sf_sensitivity";
const TOUCH_SENSITIVITY_KEY = "sf_touch_sensitivity";

/* Movement keys by physical position (KeyboardEvent.code), so WASD works
 * on AZERTY and Dvorak without rebinding. Actions are read from `key`,
 * which is what a player would name them by. */
const MOVEMENT_BY_CODE: Record<string, keyof Pick<
    InputSnapshot,
    "forward" | "back" | "left" | "right"
>> = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "back",
    ArrowDown: "back",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
};

/* Jump and crouch, read by physical position like the movement keys so
 * the binding survives a non-QWERTY layout. Space jumps; either control
 * key or C crouches. Held like the movement keys: the frame reports what
 * was down when it was sampled. */
const STANCE_BY_CODE: Record<string, keyof Pick<InputSnapshot, "jump" | "crouch">> = {
    Space: "jump",
    ControlLeft: "crouch",
    ControlRight: "crouch",
    KeyC: "crouch",
};

export class InputController {
    private held = new Set<string>();
    private firing = false;
    private yaw = 0;
    private pitch = 0;
    private sensitivity = readSensitivity();
    private touchSensitivity = readTouchSensitivity();
    private target: HTMLElement | null = null;
    private locked = false;
    private lockListeners = new Set<LockListener>();
    private pendingReload = false;
    private pendingWeapon: string | null = null;

    attach(target: HTMLElement): void {
        this.target = target;
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mouseup", this.onMouseUp);
        window.addEventListener("storage", this.onStorage);
        document.addEventListener("pointerlockchange", this.onLockChange);
    }

    dispose(): void {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mousedown", this.onMouseDown);
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("storage", this.onStorage);
        document.removeEventListener("pointerlockchange", this.onLockChange);
        this.lockListeners.clear();
        this.held.clear();
        this.target = null;
    }

    /** Ask for pointer lock. Must be called from a user gesture. */
    async requestLock(): Promise<boolean> {
        const target = this.target;
        if (!target) return false;
        try {
            const result = target.requestPointerLock();
            if (result instanceof Promise) await result;
        } catch {
            // Refused (no gesture, or the browser is rate-limiting a
            // re-request straight after an Escape). The caller keeps the
            // click-to-play overlay up and the player tries again.
            return false;
        }
        return document.pointerLockElement === target;
    }

    releaseLock(): void {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    isLocked(): boolean {
        return this.locked;
    }

    onLockedChange(listener: LockListener): () => void {
        this.lockListeners.add(listener);
        return () => this.lockListeners.delete(listener);
    }

    setSensitivity(value: number): void {
        if (Number.isFinite(value) && value > 0) this.sensitivity = value;
    }

    /* The settings screen writes the stored key and announces it, the
     * way `AudioEngine` is told about a volume. A player dragging the
     * slider is aiming at the same time, so the change has to reach the
     * live controller rather than the next page load. */
    private onStorage = (event: StorageEvent): void => {
        if (event.key === SENSITIVITY_KEY) this.sensitivity = readSensitivity();
        else if (event.key === TOUCH_SENSITIVITY_KEY)
            this.touchSensitivity = readTouchSensitivity();
    };

    /** The current intent. Sampled once per rendered frame. */
    sample(): InputSnapshot {
        return {
            forward: this.isHeld("forward"),
            back: this.isHeld("back"),
            left: this.isHeld("left"),
            right: this.isHeld("right"),
            fire: this.firing,
            jump: this.isHeld("jump"),
            crouch: this.isHeld("crouch"),
            yaw: this.yaw,
            pitch: this.pitch,
        };
    }

    /** Drain a queued reload request, if the player pressed R. */
    takeReload(): boolean {
        const pending = this.pendingReload;
        this.pendingReload = false;
        return pending;
    }

    /** Drain a queued weapon switch, if the player pressed 1 or 2. */
    takeWeaponSwitch(): string | null {
        const pending = this.pendingWeapon;
        this.pendingWeapon = null;
        return pending;
    }

    /** Aim the camera directly. Used to adopt the server's spawn facing. */
    setLook(yaw: number, pitch: number): void {
        this.yaw = yaw;
        this.pitch = clampPitch(pitch);
    }

    /* The touch layout's handle on this controller (issue #17).
     *
     * These write the very same fields the mouse and keyboard write -
     * `held`, `firing`, `yaw`, `pitch`, the pending reload and weapon -
     * so `sample()` reads one intent and the wire never learns whether a
     * finger or a key produced it. None of them consult the pointer lock:
     * lock is the browser's gate on relative *mouse* deltas, and a touch
     * device has neither the lock nor the mouse. `onBlur` still clears
     * everything if the tab loses focus mid-press, so a lifted finger the
     * browser swallowed does not leave the player walking. */
    touchInput(): TouchInput {
        return {
            move: (x, y) => {
                const buttons = stickToButtons(x, y);
                this.setHeld("forward", buttons.forward);
                this.setHeld("back", buttons.back);
                this.setHeld("left", buttons.left);
                this.setHeld("right", buttons.right);
            },
            look: (dx, dy) => {
                this.yaw -= dx * this.touchSensitivity;
                this.pitch = clampPitch(this.pitch - dy * this.touchSensitivity);
            },
            fire: (down) => {
                this.firing = down;
            },
            jump: (down) => this.setHeld("jump", down),
            crouch: (down) => this.setHeld("crouch", down),
            reload: () => {
                this.pendingReload = true;
            },
            switchWeapon: (weapon) => {
                this.pendingWeapon = weapon;
            },
        };
    }

    private setHeld(action: string, held: boolean): void {
        if (held) this.held.add(action);
        else this.held.delete(action);
    }

    private isHeld(action: string): boolean {
        return this.held.has(action);
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        if (!this.locked) return;
        const movement = MOVEMENT_BY_CODE[event.code];
        if (movement) {
            this.held.add(movement);
            // Arrow keys scroll the page otherwise, which drags the
            // canvas out from under a player who never left it.
            event.preventDefault();
            return;
        }
        const stance = STANCE_BY_CODE[event.code];
        if (stance) {
            this.held.add(stance);
            // Space scrolls the page and a lone Control key does nothing
            // useful in game; swallow both so neither reaches the browser.
            event.preventDefault();
            return;
        }
        if (event.repeat) return;
        const key = event.key.toLowerCase();
        if (key === "r") this.pendingReload = true;
        else if (key === "1") this.pendingWeapon = "rifle";
        else if (key === "2") this.pendingWeapon = "smg";
    };

    private onKeyUp = (event: KeyboardEvent): void => {
        const movement = MOVEMENT_BY_CODE[event.code];
        if (movement) this.held.delete(movement);
        const stance = STANCE_BY_CODE[event.code];
        if (stance) this.held.delete(stance);
    };

    /* Losing focus mid-stride leaves a key logically held forever,
     * because the keyup lands on whatever took focus. */
    private onBlur = (): void => {
        this.held.clear();
        this.firing = false;
    };

    private onMouseMove = (event: MouseEvent): void => {
        if (!this.locked) return;
        this.yaw -= event.movementX * this.sensitivity;
        this.pitch = clampPitch(this.pitch - event.movementY * this.sensitivity);
    };

    private onMouseDown = (event: MouseEvent): void => {
        if (event.button === 0 && this.locked) this.firing = true;
    };

    private onMouseUp = (event: MouseEvent): void => {
        if (event.button === 0) this.firing = false;
    };

    private onLockChange = (): void => {
        this.locked = document.pointerLockElement === this.target;
        if (!this.locked) {
            // Escape drops the lock. Everything held goes with it, so
            // the player does not walk into a wall while reading a menu.
            this.held.clear();
            this.firing = false;
        }
        for (const listener of this.lockListeners) listener(this.locked);
    };
}

function clampPitch(pitch: number): number {
    if (pitch > PITCH_LIMIT) return PITCH_LIMIT;
    if (pitch < -PITCH_LIMIT) return -PITCH_LIMIT;
    return pitch;
}

function readSensitivity(): number {
    const stored = Number(window.localStorage.getItem(SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SENSITIVITY;
}

/* The look pad's own dial (issue #34). Falls back to the same default as
 * the mouse, so an unset touch sensitivity aims exactly as the look pad
 * did when it borrowed the mouse value. */
function readTouchSensitivity(): number {
    const stored = Number(window.localStorage.getItem(TOUCH_SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SENSITIVITY;
}
