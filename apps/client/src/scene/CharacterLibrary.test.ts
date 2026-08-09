/* The character instance's orientation contract.
 *
 * The instance is what a lobby of opponents is built from, and its one
 * contract is directional: the game's yaw faces -Z (`movement`), while
 * the asset was authored facing +Z (the Mixamo convention). The flip in
 * `create()` is what makes the front the front, and it breaks silently
 * when it drifts: a character that walks toward you showing its back
 * reads as a rendering quirk, not a failure. This test pins the asset's
 * authored facing to the turn `create()` applies, so a future asset
 * swap that faces differently must land a new turn here.
 *
 * The model is the real `public/models/robot.glb`: the browser fetches
 * it over the network, node cannot fetch a relative URL, so the loader
 * is handed the same bytes the deployed asset is built from.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CharacterLibrary } from "./CharacterLibrary";

const ASSET_PATH = fileURLToPath(
    new URL("../../public/models/robot.glb", import.meta.url),
);

const PLAYER_HEIGHT = 1.7;

describe("CharacterLibrary", () => {
    let modelBytes: ArrayBuffer;

    beforeAll(() => {
        const bytes = fs.readFileSync(ASSET_PATH);
        modelBytes = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        );
        // FileLoader builds a `Request` from the library's model URL
        // before it calls `fetch`. Node cannot parse the relative URL
        // that a browser would resolve against its origin, so both are
        // replaced: the request carries the URL unparsed, the fetch
        // answers with the asset's bytes.
        vi.stubGlobal(
            "Request",
            class StubRequest {
                constructor(readonly url: string) {}
            },
        );
        vi.stubGlobal("fetch", vi.fn(async () => new Response(modelBytes)));
        // Node has no global `ProgressEvent`; three's FileLoader builds
        // one for its streaming progress callbacks while reading the
        // response body, so the fields it reads are stubbed.
        vi.stubGlobal(
            "ProgressEvent",
            class StubProgressEvent {
                readonly lengthComputable: boolean;
                readonly loaded: number;
                readonly total: number;
                constructor(
                    readonly type: string,
                    init: {
                        lengthComputable?: boolean;
                        loaded?: number;
                        total?: number;
                    } = {},
                ) {
                    this.lengthComputable = init.lengthComputable ?? false;
                    this.loaded = init.loaded ?? 0;
                    this.total = init.total ?? 0;
                }
            },
        );
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it("presents the asset facing -Z, the game's forward", async () => {
        const library = await new CharacterLibrary(PLAYER_HEIGHT).ready();
        expect(library).not.toBeNull();
        const instance = library!.create(new THREE.Color("#ff0000"));
        expect(instance).not.toBeNull();

        // A point one metre in front of the authored face (its +Z) must
        // read as the game's forward (-Z) in the instance. The root
        // also carries the height scale, so direction is asserted
        // against the probe's length, not its raw z.
        const probe = new THREE.Object3D();
        probe.position.set(0, 0, 1);
        instance!.root.add(probe);
        const front = probe.getWorldPosition(new THREE.Vector3());
        expect(front.x).toBeCloseTo(0, 6);
        expect(front.z).toBeLessThan(0);
        expect(front.z / front.length()).toBeCloseTo(-1, 6);

        // Facing alone does not pin the turn: a half-turn about X maps
        // the authored face to -Z exactly as the intended one about Y
        // does, and leaves the height extent untouched, so it renders
        // the character inverted and nothing above notices. Up must
        // still be up, which only the Y turn preserves.
        const overhead = new THREE.Object3D();
        overhead.position.set(0, 1, 0);
        instance!.root.add(overhead);
        const above = overhead.getWorldPosition(new THREE.Vector3());
        expect(above.y / above.length()).toBeCloseTo(1, 6);

        // The flip is about facing, not about size or stance: the
        // instance still stands at the player height it was asked for,
        // with its feet on the ground rather than hanging below it.
        const bounds = new THREE.Box3().setFromObject(instance!.root);
        expect(bounds.max.y - bounds.min.y).toBeCloseTo(PLAYER_HEIGHT, 3);
        // The bind pose dips a few millimetres under the origin, so the
        // ground is a tolerance rather than an equality; an inverted
        // instance would hang a whole body length beneath it.
        expect(bounds.min.y).toBeGreaterThan(-0.05);

        instance!.dispose();
        library!.dispose();
    });
});
