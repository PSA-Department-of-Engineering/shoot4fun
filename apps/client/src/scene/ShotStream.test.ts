/* Reading shots out of magazines.
 *
 * Every case here is one of the ways a magazine changes size, because
 * the whole risk in deriving shots from ammunition is mistaking one of
 * the other three for a shot: a player who reloads, respawns or swaps
 * weapons must not fire a phantom burst of muzzle flashes.
 */

import { describe, expect, it } from "vitest";

import type { PlayerWire } from "../net/protocol";
import { ShotStream, type Shot } from "./ShotStream";

function player(overrides: Partial<PlayerWire> = {}): PlayerWire {
    return {
        id: "p1",
        name: "player",
        position: { x: 0, y: 0, z: 0 },
        yaw: 0,
        pitch: 0,
        hp: 100,
        max_hp: 100,
        is_alive: true,
        respawn_in: 0,
        kills: 0,
        deaths: 0,
        is_ready: true,
        team: 1,
        equipped_weapon: "rifle",
        ammo: 30,
        magazine_size: 30,
        is_reloading: false,
        last_input_seq: 0,
        ...overrides,
    };
}

function read(stream: ShotStream, ...players: PlayerWire[]): Shot[] {
    const out: Shot[] = [];
    stream.read(players, out);
    return out.map((shot) => ({ ...shot }));
}

describe("ShotStream", () => {
    it("says nothing about a player it is seeing for the first time", () => {
        const stream = new ShotStream();
        expect(read(stream, player({ ammo: 17 }))).toEqual([]);
    });

    it("reads one missing round as one shot", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 30 }));
        expect(read(stream, player({ ammo: 29 }))).toEqual([
            { playerId: "p1", count: 1 },
        ]);
    });

    it("reads several missing rounds as several shots", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 30 }));
        expect(read(stream, player({ ammo: 28 }))).toEqual([
            { playerId: "p1", count: 2 },
        ]);
    });

    it("does not fire on a reload", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 3 }));
        expect(read(stream, player({ ammo: 30 }))).toEqual([]);
    });

    it("does not fire on a respawn", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 30, is_alive: false }));
        expect(read(stream, player({ ammo: 30, is_alive: true }))).toEqual([]);
    });

    it("does not fire when a weapon switch shrinks the magazine", () => {
        const stream = new ShotStream();
        read(stream, player({ equipped_weapon: "smg", ammo: 40, magazine_size: 40 }));
        const switched = read(
            stream,
            player({ equipped_weapon: "rifle", ammo: 30, magazine_size: 30 }),
        );
        expect(switched).toEqual([]);
    });

    it("caps what one snapshot may report, so a stalled tab does not empty a magazine at once", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 30 }));
        expect(read(stream, player({ ammo: 5 }))).toEqual([
            { playerId: "p1", count: 3 },
        ]);
    });

    it("reads every player in the room, not just one", () => {
        const stream = new ShotStream();
        read(stream, player({ id: "a" }), player({ id: "b" }));
        const shots = read(
            stream,
            player({ id: "a", ammo: 29 }),
            player({ id: "b", ammo: 28 }),
        );
        expect(shots).toEqual([
            { playerId: "a", count: 1 },
            { playerId: "b", count: 2 },
        ]);
    });

    it("forgets a player who left, so the magazine they come back with is not a burst", () => {
        const stream = new ShotStream();
        read(stream, player({ id: "a", ammo: 30 }), player({ id: "b", ammo: 30 }));
        read(stream, player({ id: "a", ammo: 30 }));
        // Against a remembered 30 this reads as a burst; against a
        // player the stream has never seen it reads as nothing.
        expect(read(stream, player({ id: "a", ammo: 30 }), player({ id: "b", ammo: 2 })))
            .toEqual([]);
    });

    it("starts over when a new match hands out fresh magazines", () => {
        const stream = new ShotStream();
        read(stream, player({ ammo: 30 }));
        stream.clear();
        expect(read(stream, player({ ammo: 12 }))).toEqual([]);
    });
});
