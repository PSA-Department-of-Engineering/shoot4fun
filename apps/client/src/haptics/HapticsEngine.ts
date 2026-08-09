/* Haptic feedback engine. The tactile twin of `AudioEngine`: a
 * client-only cue layer that reads its enablement from `localStorage`
 * (`sf_haptics`) and live-updates on the `storage` event, so the toggle
 * in the settings panel reaches it exactly the way a volume slider
 * reaches the audio.
 *
 * Every cue is a short `navigator.vibrate` pulse. The Vibration API
 * exists only on touch devices (and fires only after a user gesture),
 * so on a desktop with a mouse these calls are silent no-ops - which is
 * why this is polish, not a contract: it adds a tactile echo of the
 * audio where the hardware can give one, and costs nothing where it
 * cannot. Nothing here crosses the wire.
 */

const STORAGE_HAPTICS = "sf_haptics";

// Distinct pulse lengths (milliseconds), so the three cues read
// differently through the case: firing is the lightest tick, landing a
// hit a crisper confirmation, taking a hit the heaviest jolt.
const FIRE_MS = 10;
const HIT_MS = 18;
const HURT_MS = 35;

function readEnabled(): boolean {
    const raw = window.localStorage.getItem(STORAGE_HAPTICS);
    // Absent means default-on: a touch player feels the feedback without
    // first hunting for a switch, and can turn it off in settings.
    return raw === null ? true : raw !== "0";
}

export class HapticsEngine {
    private enabled = true;
    private wired = false;

    /** Read the current preference and start following the toggle. Idempotent
     * and self-firing, so cue callers need no wiring order. */
    ensure(): void {
        if (this.wired) return;
        this.wired = true;
        this.enabled = readEnabled();
        window.addEventListener("storage", (e) => {
            if (e.key === STORAGE_HAPTICS) this.enabled = readEnabled();
        });
    }

    private buzz(pattern: number): void {
        this.ensure();
        if (!this.enabled) return;
        // The API is absent on desktop; feature-detect rather than assume.
        if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
            return;
        }
        navigator.vibrate(pattern);
    }

    /** The player pulled the trigger. */
    fire(): void {
        this.buzz(FIRE_MS);
    }

    /** A round the player fired landed on an opponent. */
    hit(): void {
        this.buzz(HIT_MS);
    }

    /** The player took a hit. */
    hurt(): void {
        this.buzz(HURT_MS);
    }
}
