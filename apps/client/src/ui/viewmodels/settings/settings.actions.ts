/* Settings actions. Each setter writes the key the game module reads, so
 * the preference and the thing it controls share one source.
 *
 * `AudioEngine` follows the volume keys through the `storage` event,
 * which a browser fires only at *other* tabs. Setting a volume therefore
 * dispatches the event here as well, so the tab making the change hears
 * it too.
 */

import { create } from "zustand";

import {
    DEFAULT_MASTER_VOLUME,
    DEFAULT_SENSITIVITY,
    DEFAULT_SFX_VOLUME,
    MASTER_VOLUME_KEY,
    SENSITIVITY_KEY,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    SFX_VOLUME_KEY,
    type SettingsState,
} from "./settings.state";

interface SettingsActions {
    hydrate: () => void;
    open: () => void;
    close: () => void;
    setSensitivity: (value: number) => void;
    setMasterVolume: (value: number) => void;
    setSfxVolume: (value: number) => void;
}

function readStored(key: string, fallback: number): number {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function persist(key: string, value: number): void {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
}

export const useSettings = create<SettingsState & SettingsActions>()((set) => ({
    isOpen: false,
    sensitivity: DEFAULT_SENSITIVITY,
    masterVolume: DEFAULT_MASTER_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,

    hydrate: () =>
        set({
            sensitivity: clamp(
                readStored(SENSITIVITY_KEY, DEFAULT_SENSITIVITY),
                SENSITIVITY_MIN,
                SENSITIVITY_MAX,
            ),
            masterVolume: clamp(readStored(MASTER_VOLUME_KEY, DEFAULT_MASTER_VOLUME), 0, 1),
            sfxVolume: clamp(readStored(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME), 0, 1),
        }),

    open: () => set({ isOpen: true }),

    close: () => set({ isOpen: false }),

    setSensitivity: (value) => {
        const sensitivity = clamp(value, SENSITIVITY_MIN, SENSITIVITY_MAX);
        persist(SENSITIVITY_KEY, sensitivity);
        set({ sensitivity });
    },

    setMasterVolume: (value) => {
        const masterVolume = clamp(value, 0, 1);
        persist(MASTER_VOLUME_KEY, masterVolume);
        set({ masterVolume });
    },

    setSfxVolume: (value) => {
        const sfxVolume = clamp(value, 0, 1);
        persist(SFX_VOLUME_KEY, sfxVolume);
        set({ sfxVolume });
    },
}));
