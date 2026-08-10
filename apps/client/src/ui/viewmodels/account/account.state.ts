/* The signed-in player, and the two dialogs that change who that is.
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
    /** Open dialog, if any. Registering and signing in are separate acts. */
    dialog: null | "register" | "signIn" | "rotate";
    /** The recovery code, held only for as long as it is on screen. It arrives
     *  once and no read returns it again, so leaving this set after the player
     *  dismisses it would be the only copy in a place nothing reads. */
    revealedCode: string | null;
    error: string | null;
    busy: boolean;
}

export const ACCOUNT_NAME_MIN = 2;
export const ACCOUNT_NAME_MAX = 24;
