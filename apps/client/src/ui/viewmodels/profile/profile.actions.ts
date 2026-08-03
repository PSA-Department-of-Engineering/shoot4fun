/* Profile actions: the second HTTP surface in the client.
 *
 * Adopting a username is the pre-login plumbing of issue #12: the
 * profile's settings (sensitivity, volumes) and display name ride the
 * server instead of one browser's `localStorage`, so the same username
 * on another machine brings them back. Guests never touch this store:
 * without an adopted username the game behaves exactly as before.
 *
 * The settings store remains the live source while the game runs -
 * `AudioEngine` and `InputController` read its keys - so adopting
 * applies the profile *through* the settings setters (which persist
 * and announce), and moving a slider syncs the profile without the
 * game modules ever knowing a profile exists.
 */

import { create } from "zustand";

import { useSession } from "@/ui/viewmodels/session";
import { useSettings } from "@/ui/viewmodels/settings";

import { isUsernameValid } from "./profile.model";
import {
    PROFILE_USERNAME_KEY,
    USERNAME_MAX_LENGTH,
    type ProfileState,
} from "./profile.state";

interface ProfilePayload {
    username: string;
    display_name: string;
    sensitivity: number;
    master_volume: number;
    sfx_volume: number;
}

interface ProfileActions {
    /** Adopt whatever username this browser remembers, if any. */
    hydrate: () => void;
    /** Fetch or create the profile for `username` and apply it. */
    adopt: (
        username: string,
        options?: { createOnMissing: boolean },
    ) => Promise<void>;
    /** Drop the adopted username; the `localStorage` settings stay. */
    forget: () => void;
    /** Push the current settings to the adopted profile, if there is one. */
    syncSettings: (
        sensitivity?: number,
        masterVolume?: number,
        sfxVolume?: number,
    ) => void;
}

function profileUrl(username: string): string {
    return `/api/users/${encodeURIComponent(username)}`;
}

function readStored(key: string, fallback: number): number {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

export const useProfile = create<ProfileState & ProfileActions>()((set, get) => ({
    username: null,
    displayName: "",
    status: "guest",
    error: null,

    hydrate: () => {
        const stored = window.localStorage.getItem(PROFILE_USERNAME_KEY);
        if (stored) void get().adopt(stored, { createOnMissing: false });
    },

    adopt: async (username, options = { createOnMissing: true }) => {
        const clean = username.trim().slice(0, USERNAME_MAX_LENGTH);
        if (!isUsernameValid(clean)) return;
        set({ status: "loading", error: null });

        const apply = (payload: ProfilePayload) => {
            window.localStorage.setItem(PROFILE_USERNAME_KEY, payload.username);
            // Applying through the settings setters persists the keys
            // the game modules read and announces them, so a live audio
            // bus and the input controller hear the profile's values.
            useSettings.getState().setSensitivity(payload.sensitivity);
            useSettings.getState().setMasterVolume(payload.master_volume);
            useSettings.getState().setSfxVolume(payload.sfx_volume);
            if (!useSession.getState().playerName.trim()) {
                useSession.getState().setPlayerName(
                    payload.display_name || payload.username,
                );
            }
            set({
                username: payload.username,
                displayName: payload.display_name,
                status: "ready",
                error: null,
            });
        };

        try {
            let response = await fetch(profileUrl(clean));
            if (response.status === 404 && options.createOnMissing) {
                response = await fetch(profileUrl(clean), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: clean,
                        display_name:
                            useSession.getState().playerName.trim() || clean,
                        sensitivity: readStored("sf_sensitivity", 0.0022),
                        master_volume: readStored("sf_master_volume", 0.7),
                        sfx_volume: readStored("sf_sfx_volume", 0.8),
                    }),
                });
            }
            if (response.status === 409 && options.createOnMissing) {
                // Someone else adopted the name between the GET and the
                // POST; their profile is the one to apply.
                response = await fetch(profileUrl(clean));
            }
            if (response.status === 404) {
                window.localStorage.removeItem(PROFILE_USERNAME_KEY);
                set({ status: "guest", username: null, displayName: "", error: null });
                return;
            }
            if (!response.ok) {
                set({ status: "error", error: "The profile server refused the request." });
                return;
            }
            apply((await response.json()) as ProfilePayload);
        } catch {
            set({ status: "error", error: "Could not reach the profile server." });
        }
    },

    forget: () => {
        window.localStorage.removeItem(PROFILE_USERNAME_KEY);
        set({ status: "guest", username: null, displayName: "", error: null });
    },

    syncSettings: (sensitivity, masterVolume, sfxVolume) => {
        const { username } = get();
        if (!username) return;
        const current = useSettings.getState();
        void fetch(profileUrl(username), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sensitivity: sensitivity ?? current.sensitivity,
                master_volume: masterVolume ?? current.masterVolume,
                sfx_volume: sfxVolume ?? current.sfxVolume,
            }),
        }).catch(() => {
            // The localStorage copy is still the local truth; the
            // profile catches up on the next sync.
        });
    },
}));
