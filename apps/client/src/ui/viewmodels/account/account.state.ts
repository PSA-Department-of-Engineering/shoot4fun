/* The signed-in player, and the dialogs that change who that is.
 *
 * There is no "signed out" state to design for: a guest is an account, so the
 * store holds an account from the first frame and `registered` is the only
 * thing that distinguishes a guest from a named player.
 */

export type AccountPhase = "starting" | "ready" | "offline";

export interface AccountState {
    phase: AccountPhase;
    userId: string | null;
    displayName: string | null;
    registered: boolean;
    /** Open dialog, if any. Creating, signing in and changing a password are
     *  separate acts. */
    dialog: null | "create" | "signIn" | "changePassword";
    error: string | null;
    busy: boolean;
}

export const ACCOUNT_NAME_MIN = 2;
export const ACCOUNT_NAME_MAX = 24;
