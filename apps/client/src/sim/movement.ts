/* The movement routine, client side.
 *
 * This is the mirror of the server's `domain/model/movement.py`, and it
 * exists so the client can predict its own motion instead of waiting a
 * round trip to see itself walk (ADR-0004).
 *
 * The duplication is deliberate and is held in agreement mechanically:
 * `shared/movement_trace.json` is generated from the server routine and
 * replayed by both test suites, so a divergence fails both builds and
 * names the first differing step. Change nothing here without changing
 * the server and regenerating the trace.
 *
 * Everything about this module serves that contract. It is pure, it is
 * small, and it uses plain float arithmetic only. Player-versus-player
 * separation is deliberately absent: the client cannot see where other
 * players are at the tick it is simulating, so the server applies it
 * afterwards and reconciliation corrects the difference.
 */

export const MOVE_SPEED = 6.0;
export const MAX_FRAME_DT = 0.05;
export const PLAYER_RADIUS = 0.45;
export const PITCH_LIMIT = Math.PI / 2 - 0.05;

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

export interface CoverBoxLike {
    center: Vec3Like;
    half_x: number;
    half_y: number;
    half_z: number;
}

export interface ArenaLike {
    bounds_min: Vec3Like;
    bounds_max: Vec3Like;
    cover: CoverBoxLike[];
}

/** One frame of intent, as far as movement is concerned. */
export interface MoveIntent {
    dt: number;
    yaw: number;
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
}

/** The next position for a player at `position` who sent `frame`. */
export function step(position: Vec3Like, frame: MoveIntent, arena: ArenaLike): Vec3Like {
    let dt = frame.dt;
    if (dt <= 0) return position;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

    const forward = (frame.forward ? 1 : 0) - (frame.back ? 1 : 0);
    const strafe = (frame.right ? 1 : 0) - (frame.left ? 1 : 0);
    if (forward === 0 && strafe === 0) return position;

    // Forward is -Z rotated about Y, right is +X rotated about Y: the
    // renderer's own convention, so what you look at is what you walk
    // toward. Pitch does not steer movement.
    const sinYaw = Math.sin(frame.yaw);
    const cosYaw = Math.cos(frame.yaw);
    let dx = -sinYaw * forward + cosYaw * strafe;
    let dz = -cosYaw * forward - sinYaw * strafe;

    const length = Math.sqrt(dx * dx + dz * dz);
    if (length > 0) {
        dx /= length;
        dz /= length;
    }

    const distance = MOVE_SPEED * dt;
    let x = position.x + dx * distance;
    let z = position.z + dz * distance;

    [x, z] = clampToBounds(x, z, arena);
    // Deterministic order: the arena's own cover order, on both sides.
    for (const box of arena.cover) {
        [x, z] = pushOutOf(x, z, box);
    }
    return { x, y: position.y, z };
}

function clampToBounds(x: number, z: number, arena: ArenaLike): [number, number] {
    const minX = arena.bounds_min.x + PLAYER_RADIUS;
    const maxX = arena.bounds_max.x - PLAYER_RADIUS;
    const minZ = arena.bounds_min.z + PLAYER_RADIUS;
    const maxZ = arena.bounds_max.z - PLAYER_RADIUS;
    if (x < minX) x = minX;
    else if (x > maxX) x = maxX;
    if (z < minZ) z = minZ;
    else if (z > maxZ) z = maxZ;
    return [x, z];
}

/* Resolve a player circle against one cover box.
 *
 * The box is expanded by the player's radius and the player treated as
 * a point, which turns circle-versus-box into point-versus-box: no
 * square roots, no tie-break ambiguity, and an identical result in both
 * runtimes. The point leaves by whichever face is nearest, so sliding
 * along cover falls out for free. */
function pushOutOf(x: number, z: number, box: CoverBoxLike): [number, number] {
    const minX = box.center.x - box.half_x - PLAYER_RADIUS;
    const maxX = box.center.x + box.half_x + PLAYER_RADIUS;
    const minZ = box.center.z - box.half_z - PLAYER_RADIUS;
    const maxZ = box.center.z + box.half_z + PLAYER_RADIUS;
    if (!(minX < x && x < maxX && minZ < z && z < maxZ)) return [x, z];

    const toMinX = x - minX;
    const toMaxX = maxX - x;
    const toMinZ = z - minZ;
    const toMaxZ = maxZ - z;
    const nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
    if (nearest === toMinX) return [minX, z];
    if (nearest === toMaxX) return [maxX, z];
    if (nearest === toMinZ) return [x, minZ];
    return [x, maxZ];
}

export function clampPitch(pitch: number): number {
    if (pitch > PITCH_LIMIT) return PITCH_LIMIT;
    if (pitch < -PITCH_LIMIT) return -PITCH_LIMIT;
    return pitch;
}
