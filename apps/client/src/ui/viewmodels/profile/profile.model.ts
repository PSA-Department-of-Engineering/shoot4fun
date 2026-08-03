/* Pure reads over `ProfileState`. No Zustand, no I/O. */

import type { ProfileState } from "./profile.state";
import { USERNAME_MAX_LENGTH } from "./profile.state";

export const selectUsername = (s: ProfileState): string | null => s.username;
export const selectDisplayName = (s: ProfileState): string => s.displayName;
export const selectProfileStatus = (s: ProfileState): ProfileState["status"] => s.status;
export const selectProfileError = (s: ProfileState): string | null => s.error;

/** A profile is live when its fetch has succeeded and a username is held. */
export const selectIsAdopted = (s: ProfileState): boolean =>
    s.status === "ready" && s.username !== null;

/** A username is anything non-blank; the server truncates, so we bound it too. */
export function isUsernameValid(username: string): boolean {
    const trimmed = username.trim();
    return trimmed.length > 0 && trimmed.length <= USERNAME_MAX_LENGTH;
}
