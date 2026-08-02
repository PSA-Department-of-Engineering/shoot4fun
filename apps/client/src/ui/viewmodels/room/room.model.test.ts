/* The room viewmodel's derivations, against snapshots shaped like the
 * ones the server sends.
 *
 * Two of these guard behaviour the screens depend on and neither is
 * visible from the outside: Start is refused for anyone but the host of a
 * full-enough, fully-ready room, and the signature is what keeps a menu
 * still while the simulation floods the socket.
 */

import { describe, expect, it } from "vitest";

import type { PlayerWire, RoomSnapshot } from "../../../net/protocol";
import { rankPlayers, roomSignature, selectCanStart } from "./room.model";
import type { RoomState } from "./room.state";

function player(overrides: Partial<PlayerWire> & { id: string }): PlayerWire {
    return {
        name: overrides.id,
        position: { x: 0, y: 0, z: 0 },
        yaw: 0,
        pitch: 0,
        hp: 100,
        max_hp: 100,
        is_alive: true,
        respawn_in: 0,
        kills: 0,
        deaths: 0,
        is_ready: false,
        team: 1,
        equipped_weapon: "rifle",
        ammo: 30,
        magazine_size: 30,
        is_reloading: false,
        last_input_seq: 0,
        ...overrides,
    };
}

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
    return {
        id: "ABC123",
        arena: {
            id: "sandbox",
            name: "Sandbox",
            bounds_min: { x: -30, y: 0, z: -30 },
            bounds_max: { x: 30, y: 0, z: 30 },
            cover: [],
            spawn_points: [],
        },
        state: "lobby",
        host_id: "one",
        tick: 0,
        players: [],
        kills: {},
        winner: null,
        time_remaining: null,
        ...overrides,
    };
}

function state(over: Partial<RoomState> = {}): RoomState {
    return {
        snapshot: null,
        localPlayerId: "one",
        pointerLocked: false,
        arenas: [],
        ...over,
    };
}

describe("selectCanStart", () => {
    const readyPair = [
        player({ id: "one", is_ready: true }),
        player({ id: "two", is_ready: true }),
    ];

    it("lets the host start a full-enough, fully-ready lobby", () => {
        expect(selectCanStart(state({ snapshot: snapshot({ players: readyPair }) }))).toBe(
            true,
        );
    });

    it("refuses anyone who is not the host", () => {
        const room = state({
            snapshot: snapshot({ players: readyPair }),
            localPlayerId: "two",
        });
        expect(selectCanStart(room)).toBe(false);
    });

    it("refuses a room one player short", () => {
        const players = [player({ id: "one", is_ready: true })];
        expect(selectCanStart(state({ snapshot: snapshot({ players }) }))).toBe(false);
    });

    it("refuses while anyone is still unready", () => {
        const players = [player({ id: "one", is_ready: true }), player({ id: "two" })];
        expect(selectCanStart(state({ snapshot: snapshot({ players }) }))).toBe(false);
    });

    it("refuses once the match is running", () => {
        const room = snapshot({ players: readyPair, state: "playing" });
        expect(selectCanStart(state({ snapshot: room }))).toBe(false);
    });
});

describe("rankPlayers", () => {
    it("orders by kills, then by fewer deaths", () => {
        const players = [
            player({ id: "a", kills: 3, deaths: 4 }),
            player({ id: "b", kills: 5, deaths: 2 }),
            player({ id: "c", kills: 3, deaths: 1 }),
        ];
        expect(rankPlayers(snapshot({ players })).map((p) => p.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });
});

describe("roomSignature", () => {
    it("ignores the fields only the simulation moves", () => {
        const players = [player({ id: "one" })];
        const before = snapshot({ players, tick: 10 });
        const after = snapshot({
            players: [player({ id: "one", hp: 40, position: { x: 9, y: 0, z: 2 } })],
            tick: 240,
        });
        expect(roomSignature(before)).toBe(roomSignature(after));
    });

    it("sees a player readying up", () => {
        const before = snapshot({ players: [player({ id: "one" })] });
        const after = snapshot({ players: [player({ id: "one", is_ready: true })] });
        expect(roomSignature(before)).not.toBe(roomSignature(after));
    });

    it("sees the map change", () => {
        const before = snapshot();
        const after = snapshot({
            arena: { ...snapshot().arena, id: "atrium", name: "Atrium" },
        });
        expect(roomSignature(before)).not.toBe(roomSignature(after));
    });
});
