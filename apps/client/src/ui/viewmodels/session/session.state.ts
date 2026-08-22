/* Who is playing, which room they asked for, and whether the socket
 * carrying that answer is up. */

import type { ConnectionStatus } from "@/app/GameRuntime";

/** `idle` is before the first connect attempt; the rest come from the socket. */
export type ConnectionState = "idle" | ConnectionStatus;

/** Where the player stands relative to a room, not what the room is doing. */
export type JoinPhase = "entry" | "joining" | "joined";

/** Which pre-room screen is showing (issue #42). `launch` asks guest-vs-login;
 * `menu` is the growable front door both choices land on; `arsenal` is the
 * Arsenal view; the three shop screens are the locked flow catalog ->
 * detail -> acquired (ADR-0008). The room flow itself is independent of
 * these: a joined room overrides all of them. */
export type MenuScreen =
    | "launch"
    | "menu"
    | "arsenal"
    | "shop-catalog"
    | "shop-item"
    | "shop-acquired";

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
    /** Which pre-room screen is up (issue #42). */
    screen: MenuScreen;
}

export const NAME_MAX_LENGTH = 16;
export const ROOM_CODE_LENGTH = 6;
