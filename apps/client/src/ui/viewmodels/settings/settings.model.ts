/* Pure reads over `SettingsState`. No Zustand, no I/O. */

import type { SettingsState } from "./settings.state";

export const selectIsSettingsOpen = (s: SettingsState): boolean => s.isOpen;
export const selectSensitivity = (s: SettingsState): number => s.sensitivity;
export const selectTouchSensitivity = (s: SettingsState): number => s.touchSensitivity;
export const selectMasterVolume = (s: SettingsState): number => s.masterVolume;
export const selectSfxVolume = (s: SettingsState): number => s.sfxVolume;
export const selectHapticsEnabled = (s: SettingsState): boolean => s.hapticsEnabled;

/* Sensitivity is radians per pixel, which is a number no player has an
 * opinion about. Scaled up it reads like every other game's dial. */
export function formatSensitivity(sensitivity: number): string {
    return (sensitivity * 1000).toFixed(2);
}

export function formatVolume(volume: number): string {
    return `${Math.round(volume * 100)}%`;
}
