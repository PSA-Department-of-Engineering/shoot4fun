/* Selectors and the one rule about a display name the client enforces. */

import { ACCOUNT_NAME_MAX, ACCOUNT_NAME_MIN, type AccountState } from "./account.state";

export const selectDisplayName = (s: AccountState) => s.displayName;
export const selectRegistered = (s: AccountState) => s.registered;
export const selectDialog = (s: AccountState) => s.dialog;
export const selectRevealedCode = (s: AccountState) => s.revealedCode;
export const selectAccountError = (s: AccountState) => s.error;
export const selectAccountBusy = (s: AccountState) => s.busy;

/** True once there is an account to act on, guest or named. */
export const selectHasAccount = (s: AccountState) => s.phase === "ready";

export function isDisplayNameValid(raw: string): boolean {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (cleaned.length < ACCOUNT_NAME_MIN || cleaned.length > ACCOUNT_NAME_MAX) return false;
    return /^[\p{L}\p{N} _.-]+$/u.test(cleaned);
}
