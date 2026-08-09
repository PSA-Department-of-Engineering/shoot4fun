/* Client-side prediction and reconciliation (ADR-0004).
 *
 * The player moves the instant they press a key, because waiting for
 * the server to answer is what makes a networked game feel broken. The
 * server still decides where they really are, so the two have to be
 * reconciled without the correction being visible.
 *
 * The loop:
 *
 *  1. Every frame, `predict` applies the input locally with the same
 *     routine the server will use, and keeps the frame in a pending
 *     buffer tagged with its sequence number.
 *  2. Every snapshot, `reconcile` drops the frames the server has now
 *     consumed, snaps to the authoritative position, and replays the
 *     frames it has not seen yet.
 *
 * When both sides agree, replaying lands exactly where the player
 * already is and the correction is zero, so nothing moves on screen.
 * When they disagree, the player is corrected by the difference and
 * only the difference, which is the smallest visible fix available.
 *
 * Vertical velocity is never on the wire (issue #10), so a reconcile
 * cannot snap to a server-sent `vy`. Instead each pending frame records
 * the velocity that was current *before* it was applied, and replay
 * re-seeds from the oldest surviving frame's value on top of the
 * authoritative position. The jump arc the client predicted is thus
 * rebuilt over the corrected feet, and any residual divergence is
 * absorbed by the next snapshot exactly as a horizontal one is.
 */

import { step, type ArenaLike, type MoveIntent, type MoveState, type Vec3Like } from "./movement";

interface PendingFrame {
    seq: number;
    frame: MoveIntent;
    vyBefore: number;
}

/** Mispredictions above this (metres) are worth knowing about. */
export const DESYNC_THRESHOLD = 0.25;

export class Predictor {
    private pending: PendingFrame[] = [];
    private state: MoveState = { position: { x: 0, y: 0, z: 0 }, vy: 0 };
    private lastCorrection = 0;

    /** Adopt an authoritative position with no replay: spawn, respawn. */
    reset(position: Vec3Like): void {
        this.state = { position: { ...position }, vy: 0 };
        this.pending = [];
        this.lastCorrection = 0;
    }

    current(): Vec3Like {
        return this.state.position;
    }

    /** How far the last snapshot moved us. A running desync measure. */
    correction(): number {
        return this.lastCorrection;
    }

    pendingCount(): number {
        return this.pending.length;
    }

    /** Apply one frame locally and remember it until the server acks it. */
    predict(seq: number, frame: MoveIntent, arena: ArenaLike): Vec3Like {
        const vyBefore = this.state.vy;
        this.state = step(this.state, frame, arena);
        this.pending.push({ seq, frame, vyBefore });
        return this.state.position;
    }

    /**
     * Fold in the server's word.
     *
     * `ackSeq` is the last input the server consumed. Everything up to
     * and including it is settled history and is discarded; everything
     * after it is replayed on top of the authoritative position, seeded
     * with the vertical velocity the client believed at the ack point.
     */
    reconcile(authoritative: Vec3Like, ackSeq: number, arena: ArenaLike): number {
        const before = this.state.position;
        this.pending = this.pending.filter((p) => p.seq > ackSeq);

        const vy = this.pending.length ? this.pending[0].vyBefore : this.state.vy;
        let state: MoveState = { position: { ...authoritative }, vy };
        for (const p of this.pending) {
            state = step(state, p.frame, arena);
        }
        this.state = state;

        const dx = state.position.x - before.x;
        const dz = state.position.z - before.z;
        this.lastCorrection = Math.sqrt(dx * dx + dz * dz);
        return this.lastCorrection;
    }
}
