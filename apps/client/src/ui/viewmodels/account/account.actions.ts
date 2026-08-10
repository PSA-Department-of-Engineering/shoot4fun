/* Account actions: entry, registration, sign-in, rotation, sign-out.
 *
 * `hydrate` is the entry path and it never blocks play. It adopts the stored
 * session if there is one and mints a guest if there is not; if the server is
 * unreachable it lands in `offline` and the game still runs, because an account
 * is optional and a network failure must not become a login wall.
 */

import { create } from "zustand";

import {
    AccountRequestError,
    fetchMe,
    forgetToken,
    register as registerRequest,
    rotate as rotateRequest,
    signIn as signInRequest,
    signOut as signOutRequest,
    startGuest,
    storedToken,
} from "@/net/accountApi";

import type { AccountPhase, AccountState } from "./account.state";

interface AccountActions {
    hydrate: () => Promise<void>;
    openDialog: (dialog: "register" | "signIn" | "rotate") => void;
    closeDialog: () => void;
    dismissCode: () => void;
    register: (displayName: string) => Promise<void>;
    signIn: (displayName: string, recoveryCode: string) => Promise<void>;
    rotate: (currentCode: string) => Promise<void>;
    signOut: () => Promise<void>;
}

function messageOf(error: unknown): string {
    if (error instanceof AccountRequestError) return error.message;
    return "Could not reach the server.";
}

/* Imported at call time, not at module load: the settings store reads this one
 * to know whether a player is registered, so a static import would be a cycle. */
async function settingsStore() {
    const { useSettings } = await import("@/ui/viewmodels/settings");
    return useSettings.getState();
}

export const useAccount = create<AccountState & AccountActions>()((set, get) => ({
    phase: "starting" as AccountPhase,
    userId: null,
    displayName: null,
    registered: false,
    dialog: null,
    revealedCode: null,
    error: null,
    busy: false,

    hydrate: async () => {
        try {
            if (storedToken()) {
                const me = await fetchMe().catch(async (error) => {
                    // A token the server no longer knows is not an error to show
                    // a player: drop it and start a fresh guest.
                    if (error instanceof AccountRequestError && error.status === 401) {
                        forgetToken();
                        return null;
                    }
                    throw error;
                });
                if (me) {
                    set({
                        phase: "ready",
                        userId: me.user_id,
                        displayName: me.display_name,
                        registered: me.registered,
                    });
                    return;
                }
            }
            const guest = await startGuest();
            set({
                phase: "ready",
                userId: guest.user_id,
                displayName: guest.display_name,
                registered: guest.registered,
            });
        } catch {
            // Play is never gated on this call succeeding.
            set({ phase: "offline" });
        }
    },

    openDialog: (dialog) => set({ dialog, error: null }),
    closeDialog: () => set({ dialog: null, error: null }),
    dismissCode: () => set({ revealedCode: null }),

    register: async (displayName) => {
        set({ busy: true, error: null });
        try {
            const minted = await registerRequest(displayName.trim());
            set({
                userId: minted.user_id,
                displayName: minted.display_name,
                registered: minted.registered,
                dialog: null,
                // Empty when this was a rename rather than an upgrade, and an
                // empty reveal is no reveal.
                revealedCode: minted.recovery_code || null,
            });
            // Registering keeps the dials the player already set, so they go up
            // rather than being replaced by an empty account's defaults.
            void (await settingsStore()).pushToAccount();
        } catch (error) {
            set({ error: messageOf(error) });
        } finally {
            set({ busy: false });
        }
    },

    signIn: async (displayName, recoveryCode) => {
        set({ busy: true, error: null });
        try {
            const session = await signInRequest(displayName.trim(), recoveryCode.trim());
            set({
                userId: session.user_id,
                displayName: session.display_name,
                registered: session.registered,
                dialog: null,
            });
            // Signing in adopts an existing account, so its dials win: that is
            // the whole point of settings following you to another machine.
            void (await settingsStore()).pullFromAccount();
        } catch (error) {
            set({ error: messageOf(error) });
        } finally {
            set({ busy: false });
        }
    },

    rotate: async (currentCode) => {
        set({ busy: true, error: null });
        try {
            const minted = await rotateRequest(currentCode.trim());
            set({ dialog: null, revealedCode: minted.recovery_code });
        } catch (error) {
            set({ error: messageOf(error) });
        } finally {
            set({ busy: false });
        }
    },

    signOut: async () => {
        set({ busy: true });
        try {
            await signOutRequest();
        } finally {
            set({ busy: false, registered: false, displayName: null, userId: null });
            // Signing out returns the player to a guest, which is an account.
            await get().hydrate();
        }
    },
}));
