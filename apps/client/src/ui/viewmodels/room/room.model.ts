/* Pure reads over `RoomState`. No Zustand, no I/O.
 *
 * Two kinds of function live here and the difference matters at the call
 * site:
 *
 *  - `select*` take the whole state and return a primitive or a reference
 *    the snapshot already owns. They are safe to hand to the store hook,
 *    which compares identities to decide whether to re-render.
 *  - `rank*` and `list*` derive a new collection from a snapshot. A page
 *    memoises them on the snapshot; subscribing to one directly would
 *    hand the store a new array every render.
 */

import type { PlayerWire, RoomSnapshot } from "@/net/protocol";

import { MIN_PLAYERS_TO_START, type MatchPhase, type RoomState } from "./room.state";

const NO_PLAYERS: readonly PlayerWire[] = [];

export const selectSnapshot = (s: RoomState): RoomSnapshot | null => s.snapshot;

export const selectPhase = (s: RoomState): MatchPhase => s.snapshot?.state ?? "lobby";

export const selectRoomId = (s: RoomState): string => s.snapshot?.id ?? "";

export const selectArenaId = (s: RoomState): string => s.snapshot?.arena.id ?? "";

export const selectArenaName = (s: RoomState): string => s.snapshot?.arena.name ?? "";

export const selectPointerLocked = (s: RoomState): boolean => s.pointerLocked;

export const selectHasSnapshot = (s: RoomState): boolean => s.snapshot !== null;

export const selectPlayerCount = (s: RoomState): number =>
    s.snapshot?.players.length ?? 0;

export const selectLocalPlayer = (s: RoomState): PlayerWire | null =>
    s.snapshot?.players.find((p) => p.id === s.localPlayerId) ?? null;

export const selectIsHost = (s: RoomState): boolean =>
    s.snapshot !== null && s.snapshot.host_id === s.localPlayerId;

export const selectIsReady = (s: RoomState): boolean =>
    selectLocalPlayer(s)?.is_ready ?? false;

export const selectAllReady = (s: RoomState): boolean => {
    const players = s.snapshot?.players ?? NO_PLAYERS;
    return players.length > 0 && players.every((p) => p.is_ready);
};

/** Start is the host's, and only once the room is a match: everyone
 * ready and enough of them to shoot at each other. */
export const selectCanStart = (s: RoomState): boolean =>
    selectIsHost(s) &&
    selectPhase(s) === "lobby" &&
    selectPlayerCount(s) >= MIN_PLAYERS_TO_START &&
    selectAllReady(s);

export const selectWinnerName = (s: RoomState): string | null => {
    const winner = s.snapshot?.winner;
    if (!winner) return null;
    return s.snapshot?.players.find((p) => p.id === winner)?.name ?? null;
};

/** The players in the order the scoreboard shows them. */
export function rankPlayers(snapshot: RoomSnapshot | null): PlayerWire[] {
    if (!snapshot) return [];
    return [...snapshot.players].sort(
        (a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name),
    );
}

/** The players in join order, which is the order the lobby lists them. */
export function listPlayers(snapshot: RoomSnapshot | null): PlayerWire[] {
    return snapshot ? [...snapshot.players] : [];
}

/* Everything the out-of-match screens render, in one string.
 *
 * Snapshots arrive at the simulation's tick rate while a match runs or
 * rests on its results, and almost every one of them says nothing new to
 * a menu. Comparing this is what keeps the React shell still between the
 * changes it actually shows. */
export function roomSignature(snapshot: RoomSnapshot): string {
    const players = snapshot.players
        .map((p) =>
            [p.id, p.name, p.team, p.is_ready ? 1 : 0, p.kills, p.deaths].join(":"),
        )
        .join(",");
    return [
        snapshot.id,
        snapshot.state,
        snapshot.arena.id,
        snapshot.host_id,
        snapshot.winner ?? "",
        players,
    ].join("|");
}
