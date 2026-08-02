/* The room as the out-of-match screens see it: the last snapshot worth
 * rendering, who we are inside it, and whether the game holds the mouse.
 *
 * The server owns every field of the snapshot (ADR-0003), so nothing here
 * is ever written locally in anticipation of the server agreeing.
 */

import type { RoomSnapshot } from "@/net/protocol";

export type MatchPhase = RoomSnapshot["state"];

export interface RoomState {
    snapshot: RoomSnapshot | null;
    localPlayerId: string;
    pointerLocked: boolean;
    /** The arenas the server offers, from `GET /api/arenas`. Empty until
     * the catalogue answers. */
    arenas: readonly ArenaOption[];
}

/** The room's capacity, enforced by the server (`ROOM_FULL`). */
export const ROOM_CAPACITY = 4;

/** The smallest room that can start a match. */
export const MIN_PLAYERS_TO_START = 2;

/* One arena as the picker offers it.
 *
 * The set, the names and the copy all come from the server, which is the
 * only thing that knows which layouts exist and the only thing that can
 * accept a `select_map`. A list of them here would be a second place to
 * add an arena, and a silent way to offer one the server would refuse. */
export interface ArenaOption {
    id: string;
    name: string;
    blurb: string;
}
