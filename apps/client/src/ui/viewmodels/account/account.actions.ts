/* Account actions: entry, account creation, sign-in, password change, sign-out.
 *
 * `hydrate` is the entry path and it never blocks play. It adopts the stored
 * session if there is one and mints a guest if there is not; if the server is
 * unreachable it lands in `offline` and the game still runs, because an account
 * is optional and a network failure must not become a login wall.
 */

import { create } from "zustand";

import {
    AccountRequestError,
    changePassword as changePasswordRequest,
    createAccount as createAccountRequest,
    fetchMe,
    forgetToken,
    signIn as signInRequest,
    signOut as signOutRequest,
    startGuest,
    storedToken,
} from "@/net/accountApi";

import { useSession } from "@/ui/viewmodels/session";

import type { AccountPhase, AccountState } from "./account.state";

interface AccountActions {
    hydrate: () => Promise<void>;
    openDialog: (dialog: "create" | "signIn" | "changePassword") => void;
    closeDialog: () => void;
    createAccount: (displayName: string, password: string) => Promise<void>;
    signIn: (displayName: string, password: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

    createAccount: async (displayName, password) => {
        set({ busy: true, error: null });
        try {
            const account = await createAccountRequest(
                displayName.trim(),
                password,
            );
            set({
                userId: account.user_id,
                displayName: account.display_name,
                registered: account.registered,
                dialog: null,
            });
            // A successful create lands the player on the main menu (the launch
            // screen opens this dialog directly), and keeps the dials they
            // already set so they go up rather than an empty account's defaults.
            useSession.setState({ screen: "menu" });
            void (await settingsStore()).pushToAccount();
        } catch (error) {
            set({ error: messageOf(error) });
        } finally {
            set({ busy: false });
        }
    },

    signIn: async (displayName, password) => {
        set({ busy: true, error: null });
        try {
            const session = await signInRequest(displayName.trim(), password);
            set({
                userId: session.user_id,
                displayName: session.display_name,
                registered: session.registered,
                dialog: null,
            });
            // A successful sign-in lands the player on the main menu (the launch
            // screen opens this dialog directly); on the menu this is a no-op.
            useSession.setState({ screen: "menu" });
            // Signing in adopts an existing account, so its dials win: that is
            // the whole point of settings following you to another machine.
            void (await settingsStore()).pullFromAccount();
        } catch (error) {
            set({ error: messageOf(error) });
        } finally {
            set({ busy: false });
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        set({ busy: true, error: null });
        try {
            await changePasswordRequest(currentPassword, newPassword);
            set({ dialog: null });
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
