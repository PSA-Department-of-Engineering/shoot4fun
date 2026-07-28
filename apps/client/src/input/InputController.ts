/* Pointer-lock + WASD input.
 * The local player's camera drives the yaw/pitch; the move vector
 * comes from WASD. The contract:
 * - onInput is called once per tick with the latest move + look.
 * - pointer-lock failure degrades to keyboard-look (arrow keys).
 * - the controller never sends a position; only the move vector
 *   (the server is authoritative).
 */

export interface InputFrame {
    move: [number, number, number];
    look: [number, number];
    fire: boolean;
    weaponSwitch: string | null;
}

export interface InputController {
    /** Subscribe to per-tick input frames. Returns an unsubscribe fn. */
    onTick(cb: (frame: InputFrame) => void): () => void;
    /** Request pointer-lock on the given element. */
    requestPointerLock(target: HTMLElement): Promise<boolean>;
    /** True if pointer-lock is active. */
    isPointerLocked(): boolean;
    /** True if the user has disabled mouse-look (set in settings). */
    mouseLookEnabled(): boolean;
    /** Manually trigger a fire this tick (used by mouse click). */
    triggerFire(): void;
    /** Manually trigger a weapon switch. */
    triggerSwitch(weapon: string): void;
    /** Get the latest accumulated yaw/pitch (debug / e2e inspection). */
    getYawPitch(): { yaw: number; pitch: number };
    /** Force the controller to listen for input without pointer-lock.
     * Used in offline / test mode where no real pointer-lock is
     * available. */
    setActive(v: boolean): void;
}

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const MOUSE_SENSITIVITY_DEFAULT = 0.0025;

export function createInputController(opts?: {
    mouseSensitivity?: number;
}): InputController {
    const sens = opts?.mouseSensitivity ?? MOUSE_SENSITIVITY_DEFAULT;
    const keys = new Set<string>();
    let yaw = 0;
    let pitch = 0;
    let pendingFire = false;
    let pendingSwitch: string | null = null;
    const tickHandlers: Set<(f: InputFrame) => void> = new Set();
    let pointerLockedEl: Element | null = null;
    let active = false;

    const onKeyDown = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        keys.add(k);
        if (k === "1" || k === "2") {
            pendingSwitch = k;
        }
        if (k === "m" || k === "s") {
            window.dispatchEvent(
                new CustomEvent("sf:toggle-mute", { detail: { key: k } }),
            );
        }
    };
    const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.key.toLowerCase());
    };
    const onMouseMove = (e: MouseEvent) => {
        // Mouse-look works when pointer-lock is active AND when the
        // controller is "active" (set by `setActive(true)`, used in
        // offline / test mode). The pointer-lock guard stays for the
        // production path.
        if (!pointerLockedEl && !active) return;
        yaw -= e.movementX * sens;
        pitch -= e.movementY * sens;
        if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
        if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
    };
    const onMouseDown = (e: MouseEvent) => {
        if (e.button === 0) pendingFire = true;
    };
    const onPointerLockChange = () => {
        pointerLockedEl = document.pointerLockElement;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    function tickLoop(): void {
        const move: [number, number, number] = [0, 0, 0];
        if (keys.has("w")) move[2] -= 1;
        if (keys.has("s")) move[2] += 1;
        if (keys.has("a")) move[0] -= 1;
        if (keys.has("d")) move[0] += 1;
        const len = Math.hypot(move[0], move[2]);
        if (len > 0) {
            move[0] /= len;
            move[2] /= len;
        }
        const frame: InputFrame = {
            move,
            look: [yaw, pitch],
            fire: pendingFire,
            weaponSwitch: pendingSwitch,
        };
        pendingFire = false;
        pendingSwitch = null;
        for (const h of tickHandlers) h(frame);
        requestAnimationFrame(tickLoop);
    }
    requestAnimationFrame(tickLoop);

    return {
        onTick(cb) {
            tickHandlers.add(cb);
            return () => tickHandlers.delete(cb);
        },
        async requestPointerLock(target: HTMLElement) {
            try {
                const r = target.requestPointerLock();
                if (r instanceof Promise) await r;
                return document.pointerLockElement === target;
            } catch {
                return false;
            }
        },
        isPointerLocked() {
            return pointerLockedEl !== null;
        },
        mouseLookEnabled() {
            return (
                window.localStorage.getItem("sf_mouse_look") ?? "1"
            ) === "1";
        },
        triggerFire() {
            pendingFire = true;
        },
        triggerSwitch(weapon: string) {
            pendingSwitch = weapon;
        },
        getYawPitch() {
            return { yaw, pitch };
        },
        setActive(v: boolean) {
            active = v;
        },
    };
}
