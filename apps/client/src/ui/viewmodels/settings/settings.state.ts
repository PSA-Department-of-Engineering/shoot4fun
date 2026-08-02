/* Player preferences, and whether the panel holding them is open.
 *
 * The three values are stored under the keys the game modules read:
 * `InputController` reads `sf_sensitivity`, and `AudioEngine` reads
 * `sf_master_volume` and `sf_sfx_volume`.
 */

export interface SettingsState {
    isOpen: boolean;
    /** Radians of yaw per pixel of mouse travel. */
    sensitivity: number;
    masterVolume: number;
    sfxVolume: number;
}

export const SENSITIVITY_KEY = "sf_sensitivity";
export const MASTER_VOLUME_KEY = "sf_master_volume";
export const SFX_VOLUME_KEY = "sf_sfx_volume";

export const SENSITIVITY_MIN = 0.0005;
export const SENSITIVITY_MAX = 0.005;
export const SENSITIVITY_STEP = 0.0001;

export const DEFAULT_SENSITIVITY = 0.0022;
export const DEFAULT_MASTER_VOLUME = 0.7;
export const DEFAULT_SFX_VOLUME = 0.8;
