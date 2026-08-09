/* Pure reads over `SessionState`. No Zustand, no I/O.
 *
 * Every selector here returns a primitive so it is safe to subscribe to
 * directly: a selector that built a fresh object or array per call would
 * hand the store a new identity every render.
 */

import {
    NAME_MAX_LENGTH,
    ROOM_CODE_LENGTH,
    type ConnectionState,
    type SessionState,
} from "./session.state";

/* Two different sets, and the difference is the point.
 *
 * A code this client mints is drawn from the unambiguous alphabet, with
 * no O/0, I/1 or L, because a player reads it out loud. A code it
 * *accepts* is anything the server will answer to, which is any
 * alphanumeric run: room ids are minted at both ends, and refusing one
 * the server would honour turns a working invite link into a dead one. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_ACCEPTED = /[^A-Z0-9]/g;

export const selectPlayerName = (s: SessionState): string => s.playerName;
export const selectRoomCode = (s: SessionState): string => s.roomCode;
export const selectPhase = (s: SessionState): SessionState["phase"] => s.phase;
export const selectConnection = (s: SessionState): ConnectionState => s.connection;
export const selectLatencyMs = (s: SessionState): number => s.latencyMs;
export const selectError = (s: SessionState): string | null => s.error;
export const selectInviteCopied = (s: SessionState): boolean => s.inviteCopied;

/** Whether the solo aim-training range is on (issue #15). */
export const selectSolo = (s: SessionState): boolean => s.solo;

export const selectIsOnline = (s: SessionState): boolean => s.connection === "open";

/** A name is anything non-blank; the server truncates, so we bound it too. */
export function isNameValid(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= NAME_MAX_LENGTH;
}

export function isRoomCodeValid(code: string): boolean {
    return code.length === ROOM_CODE_LENGTH;
}

export const selectCanCreateRoom = (s: SessionState): boolean =>
    isNameValid(s.playerName) && s.phase !== "joining";

export const selectCanJoinRoom = (s: SessionState): boolean =>
    isNameValid(s.playerName) && isRoomCodeValid(s.roomCode) && s.phase !== "joining";

/** The fragment that carries a room, and the whole of an invite link. */
export const selectInvitePath = (s: SessionState): string => `#/${s.roomCode}`;

const CONNECTION_LABELS: Record<ConnectionState, string> = {
    idle: "Offline",
    connecting: "Connecting",
    open: "Connected",
    closed: "Disconnected",
};

export const selectConnectionLabel = (s: SessionState): string =>
    CONNECTION_LABELS[s.connection];
