/* Entity interpolation for everyone who is not you (ADR-0004).
 *
 * Snapshots arrive 20 times a second. Drawing each one as it lands
 * makes other players teleport 20 times a second, which reads as
 * stuttering even on a perfect connection: the problem is not latency,
 * it is that 20 positions cannot describe 60 frames of motion.
 *
 * The fix is to render other players slightly in the past. Snapshots go
 * into a buffer, and each frame is drawn at `now - INTERPOLATION_DELAY`,
 * which is far enough back that two snapshots almost always bracket the
 * moment being drawn. Their positions are then interpolated between
 * those two, so motion is continuous.
 *
 * The delay is the cost: you see other players about a tenth of a
 * second behind where the server has them. That is why the server
 * rewinds when resolving a shot (`ack_tick`), so a player who hit what
 * they saw is credited with the hit.
 *
 * This never applies to the local player, who is predicted forward
 * rather than interpolated back (see `Predictor`).
 */

import type { PlayerWire } from "../net/protocol";

/** How far behind the newest snapshot to render other players, in ms.
 * Two snapshot intervals at 20Hz, so a single dropped packet still
 * leaves a pair to interpolate between. */
export const INTERPOLATION_DELAY_MS = 100;

const MAX_SNAPSHOTS = 32;

export interface InterpolatedPlayer {
    id: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    isAlive: boolean;
}

interface Frame {
    receivedAt: number;
    players: Map<string, PlayerWire>;
}

export class SnapshotBuffer {
    private frames: Frame[] = [];

    push(players: PlayerWire[], receivedAt: number): void {
        const map = new Map<string, PlayerWire>();
        for (const p of players) map.set(p.id, p);
        this.frames.push({ receivedAt, players: map });
        if (this.frames.length > MAX_SNAPSHOTS) this.frames.shift();
    }

    clear(): void {
        this.frames = [];
    }

    /** Everyone except `excludeId`, positioned as of the render moment. */
    sample(now: number, excludeId: string): InterpolatedPlayer[] {
        if (this.frames.length === 0) return [];
        const renderAt = now - INTERPOLATION_DELAY_MS;

        let older: Frame | null = null;
        let newer: Frame | null = null;
        for (let i = this.frames.length - 1; i >= 0; i--) {
            if (this.frames[i].receivedAt <= renderAt) {
                older = this.frames[i];
                newer = this.frames[i + 1] ?? null;
                break;
            }
        }
        // Not enough history yet (a fresh join), or the stream stalled
        // and every frame is now older than the render moment. Either
        // way the newest frame is the best available truth.
        if (!older) older = this.frames[0];
        if (!newer) newer = this.frames[this.frames.length - 1];

        const span = newer.receivedAt - older.receivedAt;
        const t = span > 0 ? clamp01((renderAt - older.receivedAt) / span) : 1;

        const out: InterpolatedPlayer[] = [];
        for (const [id, from] of older.players) {
            if (id === excludeId) continue;
            const to = newer.players.get(id) ?? from;
            out.push({
                id,
                x: lerp(from.position.x, to.position.x, t),
                y: lerp(from.position.y, to.position.y, t),
                z: lerp(from.position.z, to.position.z, t),
                yaw: lerpAngle(from.yaw, to.yaw, t),
                pitch: lerp(from.pitch, to.pitch, t),
                // Death is a state change, not a quantity: interpolating
                // it would leave a half-dead body for 100ms.
                isAlive: to.is_alive,
            });
        }
        return out;
    }
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/* Yaw wraps, so the shortest path between 350 and 10 degrees is 20
 * degrees forward, not 340 backward. Without this a player spins on
 * the spot every time they cross the wrap point. */
function lerpAngle(a: number, b: number, t: number): number {
    const twoPi = Math.PI * 2;
    let delta = (b - a) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    return a + delta * t;
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
