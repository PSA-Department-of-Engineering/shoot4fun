/* The adopted profile: a username and the preferences that ride with it.
 *
 * `guest` is the ordinary state - the player never adopted a username
 * and everything lives in `localStorage` as it always has. `ready`
 * means a profile is adopted and its settings are the live ones.
 */

export type ProfileStatus = "guest" | "loading" | "ready" | "error";

export interface ProfileState {
    /** The adopted username; `null` while playing as a guest. */
    username: string | null;
    /** The profile's display name, used to seed the match name. */
    displayName: string;
    status: ProfileStatus;
    error: string | null;
}

/** The localStorage key the adopted username is remembered under. */
export const PROFILE_USERNAME_KEY = "sf_username";

export const USERNAME_MAX_LENGTH = 32;
