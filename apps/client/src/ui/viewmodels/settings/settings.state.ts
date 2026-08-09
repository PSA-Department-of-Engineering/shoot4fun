/* Player preferences, and whether the panel holding them is open.
 *
 * The values are stored under the keys the game modules read:
 * `InputController` reads `sf_sensitivity` for the mouse and
 * `sf_touch_sensitivity` for the look pad, `AudioEngine` reads
 * `sf_master_volume` and `sf_sfx_volume`, and `HapticsEngine` reads
 * `sf_haptics`.
 */

export interface SettingsState {
    isOpen: boolean;
    /** Radians of yaw per pixel of mouse travel. */
    sensitivity: number;
    /** Radians of yaw per pixel of look-pad drag. A finger and a mouse
     * want different dials, so the touch look pad tunes independently of
     * the desktop mouse (issue #34). */
    touchSensitivity: number;
    masterVolume: number;
    sfxVolume: number;
    /** Whether touch devices buzz on fire and on taking/landing a hit. */
    hapticsEnabled: boolean;
}

export const SENSITIVITY_KEY = "sf_sensitivity";
export const TOUCH_SENSITIVITY_KEY = "sf_touch_sensitivity";
export const MASTER_VOLUME_KEY = "sf_master_volume";
export const SFX_VOLUME_KEY = "sf_sfx_volume";
export const HAPTICS_KEY = "sf_haptics";

/* The look pad drives yaw and pitch from drag pixels the same way the
 * mouse drives them from movement pixels, so touch look shares the mouse
 * dial's radians-per-pixel range and step; only the stored value differs. */
export const SENSITIVITY_MIN = 0.0005;
export const SENSITIVITY_MAX = 0.005;
export const SENSITIVITY_STEP = 0.0001;

export const DEFAULT_SENSITIVITY = 0.0022;
/* Matches the mouse default, so a player who never opens the touch dial
 * keeps exactly the aim the look pad had before it had its own setting. */
export const DEFAULT_TOUCH_SENSITIVITY = 0.0022;
export const DEFAULT_MASTER_VOLUME = 0.7;
export const DEFAULT_SFX_VOLUME = 0.8;
// Default-on: a touch player feels the polish without hunting for the
// switch, and it is a no-op on hardware with no Vibration API anyway.
export const DEFAULT_HAPTICS_ENABLED = true;
