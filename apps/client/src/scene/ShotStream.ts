/* Who fired, read out of the world the server sends.
 *
 * A shot is not a message on the wire: the server broadcasts `damage`
 * only when a shot connects, so a missed shot arrives as nothing at
 * all. Firing therefore looks like nothing until it hits something,
 * which is exactly backwards for a shooter.
 *
 * Every snapshot does carry each player's magazine, though, and the
 * server spends a round on every shot it lets through, hit or miss. So
 * a round missing from a magazine between two snapshots *is* a shot,
 * for every player in the room and not just the one holding the mouse.
 * That is what this reads, and it is why the client needs no copy of
 * the server's rate of fire to know when to draw a muzzle flash: it is
 * not predicting a shot, it is being told about one.
 *
 * Three things also move a magazine and are not shots, and each is
 * recognised by the direction it moves in or by what moved with it: a
 * reload and a respawn refill it, and a weapon switch swaps it for the
 * new weapon's.
 */

import type { PlayerWire } from "../net/protocol";

export interface Shot {
    playerId: string;
    /** Rounds this player spent since the previous snapshot. */
    count: number;
}

/* A ceiling on what one snapshot may report. A backgrounded tab stops
 * receiving frames and resumes against a magazine that emptied while it
 * was away; without this, coming back spends the whole difference on
 * muzzle flashes at once. Two snapshots at 20Hz cover a tenth of a
 * second, which the fastest weapon in the game cannot fill. */
const MAX_PER_SNAPSHOT = 3;

interface Seen {
    ammo: number;
    weapon: string;
    alive: boolean;
}

export class ShotStream {
    private readonly previous = new Map<string, Seen>();

    /** Shots fired since the last snapshot, appended to `out`. The
     * caller owns the array, so reading every frame allocates nothing. */
    read(players: PlayerWire[], out: Shot[]): Shot[] {
        out.length = 0;
        for (const player of players) {
            const before = this.previous.get(player.id);
            const spent = before ? countShots(before, player) : 0;
            if (spent > 0) out.push({ playerId: player.id, count: spent });
            if (before) {
                before.ammo = player.ammo;
                before.weapon = player.equipped_weapon;
                before.alive = player.is_alive;
            } else {
                this.previous.set(player.id, {
                    ammo: player.ammo,
                    weapon: player.equipped_weapon,
                    alive: player.is_alive,
                });
            }
        }
        this.prune(players);
        return out;
    }

    /** Forget everyone. A new match hands out fresh magazines. */
    clear(): void {
        this.previous.clear();
    }

    private prune(players: PlayerWire[]): void {
        for (const id of this.previous.keys()) {
            if (!players.some((player) => player.id === id)) this.previous.delete(id);
        }
    }
}

function countShots(before: Seen, now: PlayerWire): number {
    // A switch hands over the new weapon's magazine, which can hold
    // fewer rounds than the old one had left.
    if (before.weapon !== now.equipped_weapon) return 0;
    // A respawn hands back a full one.
    if (!before.alive && now.is_alive) return 0;
    const spent = before.ammo - now.ammo;
    if (spent <= 0) return 0;
    return Math.min(spent, MAX_PER_SNAPSHOT);
}
