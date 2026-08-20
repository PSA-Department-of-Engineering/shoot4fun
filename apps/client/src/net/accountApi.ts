/* The account HTTP surface, and the one place the session token is held.
 *
 * The token is the only thing that authenticates a request, so it lives here
 * and nothing else reads it off storage. The server never returns it again
 * after minting it, and never returns the password digest.
 */

const SESSION_KEY = "sf_session";
const SESSION_HEADER = "X-S4F-Session";

export interface AccountView {
    user_id: string;
    display_name: string;
    registered: boolean;
}

export interface SessionView extends AccountView {
    token: string;
}

export interface ProfileView {
    sensitivity: number;
    touch_sensitivity: number;
    master_volume: number;
    sfx_volume: number;
    haptics_enabled: boolean;
}

export class AccountRequestError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

export function storedToken(): string | null {
    try {
        return window.localStorage.getItem(SESSION_KEY);
    } catch {
        return null;
    }
}

export function rememberToken(token: string): void {
    try {
        window.localStorage.setItem(SESSION_KEY, token);
    } catch {
        /* private mode: the session lives for this page only */
    }
}

export function forgetToken(): void {
    try {
        window.localStorage.removeItem(SESSION_KEY);
    } catch {
        /* nothing to forget */
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = storedToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((init.headers as Record<string, string>) ?? {}),
    };
    if (token) headers[SESSION_HEADER] = token;

    const response = await fetch(path, { ...init, headers });
    if (!response.ok) {
        const detail = await response
            .json()
            .then((body: { detail?: string }) => body.detail)
            .catch(() => undefined);
        throw new AccountRequestError(response.status, detail ?? "request failed");
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

/** Mint a guest account and its session. The entry path: no credential needed,
 *  and a guest is a real account from here on. */
export async function startGuest(): Promise<SessionView> {
    const session = await request<SessionView>("/api/account/guest", { method: "POST" });
    rememberToken(session.token);
    return session;
}

export function fetchMe(): Promise<AccountView> {
    return request<AccountView>("/api/account/me");
}

/** Name the current guest account and protect it with a password, in place.
 *  The guest session stays valid, so no token is returned or replaced. */
export function createAccount(
    displayName: string,
    password: string,
): Promise<AccountView> {
    return request<AccountView>("/api/account/create", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName, password }),
    });
}

export async function signIn(
    displayName: string,
    password: string,
): Promise<SessionView> {
    const session = await request<SessionView>("/api/account/sign-in", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName, password }),
    });
    rememberToken(session.token);
    return session;
}

/** Swap the password, proving the current one. Live sessions are kept. */
export function changePassword(
    currentPassword: string,
    newPassword: string,
): Promise<void> {
    return request<void>("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    });
}

/** Revoke the session server-side, then drop it locally. Dropping it locally
 *  alone leaves the row valid, which is not a sign-out. */
export async function signOut(): Promise<void> {
    try {
        await request<void>("/api/account/sign-out", { method: "POST" });
    } finally {
        forgetToken();
    }
}

export function fetchProfile(): Promise<ProfileView> {
    return request<ProfileView>("/api/account/profile");
}

export function saveProfile(profile: ProfileView): Promise<ProfileView> {
    return request<ProfileView>("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(profile),
    });
}

/** The Arsenal record (ARS-004): a versioned envelope that preserves unknown
 *  fields, so a future that adds unlocks, outfits, or stats grows the shape
 *  without losing a player's existing data (ADR-0007). */
export interface ArsenalView {
    version: number;
    model: string | null;
    loadout: Record<string, unknown>;
    [key: string]: unknown;
}

export function fetchArsenal(): Promise<ArsenalView> {
    return request<ArsenalView>("/api/account/arsenal");
}

export function saveArsenal(arsenal: ArsenalView): Promise<ArsenalView> {
    return request<ArsenalView>("/api/account/arsenal", {
        method: "PUT",
        body: JSON.stringify(arsenal),
    });
}

/** The session header for a call this module does not own, so the leaderboard
 *  write can attribute a score without reaching into storage itself. */
export function sessionHeaders(): Record<string, string> {
    const token = storedToken();
    return token ? { [SESSION_HEADER]: token } : {};
}
