/* Who is playing, which room they asked for, and whether the socket
 * carrying that answer is up. */

import type { ConnectionStatus } from "@/app/GameRuntime";

/** `idle` is before the first connect attempt; the rest come from the socket. */
export type ConnectionState = "idle" | ConnectionStatus;

/** Where the player stands relative to a room, not what the room is doing. */
export type JoinPhase = "entry" | "joining" | "joined";

export interface SessionState {
    playerName: string;
    roomCode: string;
    phase: JoinPhase;
    connection: ConnectionState;
    latencyMs: number;
    /** A human-readable reason the last join or socket attempt failed. */
    error: string | null;
    /** Set for the moment after the invite link is copied. */
    inviteCopied: boolean;
    /** Whether the solo aim-training range is on (issue #15). It stands
     * apart from the room state machine: a player enters it from the
     * entry screen without joining a room at all. */
    solo: boolean;
}

export const NAME_MAX_LENGTH = 16;
export const ROOM_CODE_LENGTH = 6;
