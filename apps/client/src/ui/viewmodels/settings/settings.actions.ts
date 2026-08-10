/* Settings actions. Each setter writes the key the game module reads, so
 * the preference and the thing it controls share one source.
 *
 * `AudioEngine` follows the volume keys through the `storage` event,
 * which a browser fires only at *other* tabs. Setting a volume therefore
 * dispatches the event here as well, so the tab making the change hears
 * it too.
 */

import { create } from "zustand";

import { fetchProfile, saveProfile } from "@/net/accountApi";
import { useAccount } from "@/ui/viewmodels/account";

import {
    DEFAULT_HAPTICS_ENABLED,
    DEFAULT_MASTER_VOLUME,
    DEFAULT_SENSITIVITY,
    DEFAULT_SFX_VOLUME,
    DEFAULT_TOUCH_SENSITIVITY,
    HAPTICS_KEY,
    MASTER_VOLUME_KEY,
    SENSITIVITY_KEY,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    SFX_VOLUME_KEY,
    TOUCH_SENSITIVITY_KEY,
    type SettingsState,
} from "./settings.state";

interface SettingsActions {
    hydrate: () => void;
    open: () => void;
    close: () => void;
    setSensitivity: (value: number) => void;
    setTouchSensitivity: (value: number) => void;
    setMasterVolume: (value: number) => void;
    setSfxVolume: (value: number) => void;
    setHapticsEnabled: (value: boolean) => void;
    /** Adopt the account's stored preferences, for a player who just signed in
     *  or arrived on a second device. */
    pullFromAccount: () => Promise<void>;
    /** Send these preferences up, for a player who just registered: the dials
     *  they already set are the ones they meant to keep. */
    pushToAccount: () => Promise<void>;
}

function readStored(key: string, fallback: number): number {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function readFlag(key: string, fallback: boolean): boolean {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw !== "0";
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function persist(key: string, value: number): void {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
}

function persistFlag(key: string, value: boolean): void {
    window.localStorage.setItem(key, value ? "1" : "0");
    window.dispatchEvent(new StorageEvent("storage", { key }));
}

export const useSettings = create<SettingsState & SettingsActions>()((set) => ({
    isOpen: false,
    sensitivity: DEFAULT_SENSITIVITY,
    touchSensitivity: DEFAULT_TOUCH_SENSITIVITY,
    masterVolume: DEFAULT_MASTER_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    hapticsEnabled: DEFAULT_HAPTICS_ENABLED,

    hydrate: () =>
        set({
            sensitivity: clamp(
                readStored(SENSITIVITY_KEY, DEFAULT_SENSITIVITY),
                SENSITIVITY_MIN,
                SENSITIVITY_MAX,
            ),
            touchSensitivity: clamp(
                readStored(TOUCH_SENSITIVITY_KEY, DEFAULT_TOUCH_SENSITIVITY),
                SENSITIVITY_MIN,
                SENSITIVITY_MAX,
            ),
            masterVolume: clamp(readStored(MASTER_VOLUME_KEY, DEFAULT_MASTER_VOLUME), 0, 1),
            sfxVolume: clamp(readStored(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME), 0, 1),
            hapticsEnabled: readFlag(HAPTICS_KEY, DEFAULT_HAPTICS_ENABLED),
        }),

    open: () => set({ isOpen: true }),

    close: () => set({ isOpen: false }),

    setSensitivity: (value) => {
        const sensitivity = clamp(value, SENSITIVITY_MIN, SENSITIVITY_MAX);
        persist(SENSITIVITY_KEY, sensitivity);
        set({ sensitivity });
        void pushToAccount();
    },

    setTouchSensitivity: (value) => {
        const touchSensitivity = clamp(value, SENSITIVITY_MIN, SENSITIVITY_MAX);
        persist(TOUCH_SENSITIVITY_KEY, touchSensitivity);
        set({ touchSensitivity });
        void pushToAccount();
    },

    setMasterVolume: (value) => {
        const masterVolume = clamp(value, 0, 1);
        persist(MASTER_VOLUME_KEY, masterVolume);
        set({ masterVolume });
        void pushToAccount();
    },

    setSfxVolume: (value) => {
        const sfxVolume = clamp(value, 0, 1);
        persist(SFX_VOLUME_KEY, sfxVolume);
        set({ sfxVolume });
        void pushToAccount();
    },

    setHapticsEnabled: (value) => {
        persistFlag(HAPTICS_KEY, value);
        set({ hapticsEnabled: value });
        void pushToAccount();
    },

    pullFromAccount: async () => {
        try {
            const profile = await fetchProfile();
            // Write through the same keys the game modules read, so the account
            // and the local copy never disagree about what the dial is set to.
            persist(SENSITIVITY_KEY, profile.sensitivity);
            persist(TOUCH_SENSITIVITY_KEY, profile.touch_sensitivity);
            persist(MASTER_VOLUME_KEY, profile.master_volume);
            persist(SFX_VOLUME_KEY, profile.sfx_volume);
            persistFlag(HAPTICS_KEY, profile.haptics_enabled);
            set({
                sensitivity: profile.sensitivity,
                touchSensitivity: profile.touch_sensitivity,
                masterVolume: profile.master_volume,
                sfxVolume: profile.sfx_volume,
                hapticsEnabled: profile.haptics_enabled,
            });
        } catch {
            /* The local preferences stand; a settings sync never breaks play. */
        }
    },

    pushToAccount,
}));

/* Preferences follow a signed-in player, and only a signed-in one: a guest's
 * dials stay in this browser exactly as they always have. The push is
 * fire-and-forget for the same reason the pull is: a failed sync must leave the
 * game working, and the next change will carry the whole profile anyway. */
async function pushToAccount(): Promise<void> {
    if (!useAccount.getState().registered) return;
    const s = useSettings.getState();
    try {
        await saveProfile({
            sensitivity: s.sensitivity,
            touch_sensitivity: s.touchSensitivity,
            master_volume: s.masterVolume,
            sfx_volume: s.sfxVolume,
            haptics_enabled: s.hapticsEnabled,
        });
    } catch {
        /* keep the local value; nothing here is worth interrupting a match for */
    }
}
