/* Where a shot appears to land.
 *
 * The server decides what a shot hit and tells nobody unless it hit a
 * player (`ADR-0003`). That is the right division of trust and the
 * wrong amount of information to draw with: a shot that misses still
 * has to go somewhere, or the tracer stops in mid air and the wall
 * behind the target never picks up a hole.
 *
 * So the client casts the same ray for itself, purely to place the
 * marks. Nothing here is authoritative and nothing here is sent: if
 * this ray and the server's disagree by a few centimetres because a
 * hundred milliseconds of interpolation sit between them, the game is
 * unaffected, because the only thing riding on it is where a spark
 * appears.
 *
 * Bodies are read off a proxy rather than off the character mesh. The
 * character is a stylised figure whose silhouette is nothing like the
 * cylinder the server tests, so shooting the model would leave sparks
 * where the server saw nothing but air.
 */

import * as THREE from "three";

/** The layer a shot can touch. The renderer draws layer 0, so putting
 * the geometry a shot tests on a layer of its own lets the character
 * model be drawn without being shot at, and lets a corpse stop
 * catching rounds without leaving the scene. */
export const SHOT_LAYER = 3;

export interface ShotHit {
    readonly point: THREE.Vector3;
    readonly normal: THREE.Vector3;
    /** True when a player stopped the shot, so nothing marks the world. */
    readonly body: boolean;
    readonly distance: number;
}

export class ShotRay {
    private readonly raycaster = new THREE.Raycaster();
    private readonly hits: THREE.Intersection[] = [];
    private readonly result = {
        point: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        body: false,
        distance: 0,
    };

    constructor() {
        this.raycaster.layers.set(SHOT_LAYER);
    }

    /** The nearest thing along the ray, or `null` for open sky. The
     * returned object is reused, so read it before casting again. */
    cast(
        origin: THREE.Vector3,
        direction: THREE.Vector3,
        range: number,
        targets: THREE.Object3D[],
    ): ShotHit | null {
        this.raycaster.set(origin, direction);
        this.raycaster.far = range;
        this.hits.length = 0;
        this.raycaster.intersectObjects(targets, true, this.hits);
        const nearest = this.hits[0];
        if (!nearest) return null;

        this.result.point.copy(nearest.point);
        this.result.distance = nearest.distance;
        this.result.body = nearest.object.userData.body === true;
        if (nearest.face) {
            this.result.normal
                .copy(nearest.face.normal)
                .transformDirection(nearest.object.matrixWorld)
                .normalize();
        } else {
            this.result.normal.copy(direction).negate();
        }
        return this.result;
    }
}
