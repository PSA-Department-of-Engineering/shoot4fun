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
 */

import { step, type ArenaLike, type MoveIntent, type Vec3Like } from "./movement";

interface PendingFrame {
    seq: number;
    frame: MoveIntent;
}

/** Mispredictions above this (metres) are worth knowing about. */
export const DESYNC_THRESHOLD = 0.25;

export class Predictor {
    private pending: PendingFrame[] = [];
    private position: Vec3Like = { x: 0, y: 0, z: 0 };
    private lastCorrection = 0;

    /** Adopt an authoritative position with no replay: spawn, respawn. */
    reset(position: Vec3Like): void {
        this.position = { ...position };
        this.pending = [];
        this.lastCorrection = 0;
    }

    current(): Vec3Like {
        return this.position;
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
        this.position = step(this.position, frame, arena);
        this.pending.push({ seq, frame });
        return this.position;
    }

    /**
     * Fold in the server's word.
     *
     * `ackSeq` is the last input the server consumed. Everything up to
     * and including it is settled history and is discarded; everything
     * after it is replayed on top of the authoritative position.
     */
    reconcile(authoritative: Vec3Like, ackSeq: number, arena: ArenaLike): number {
        const before = this.position;
        this.pending = this.pending.filter((p) => p.seq > ackSeq);

        let position: Vec3Like = { ...authoritative };
        for (const p of this.pending) {
            position = step(position, p.frame, arena);
        }
        this.position = position;

        const dx = position.x - before.x;
        const dz = position.z - before.z;
        this.lastCorrection = Math.sqrt(dx * dx + dz * dz);
        return this.lastCorrection;
    }
}
