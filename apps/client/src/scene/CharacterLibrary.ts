/* The character asset: one rigged model, many players.
 *
 * The model is fetched once and every player is a clone of it that
 * shares its geometry and its animation clips, so a full lobby costs
 * one download and one set of buffers. Only the materials are cloned
 * per player, because team colour and the white flash of taking a hit
 * are one player's business and must not bleed onto their team mates.
 *
 * Loading can fail: a browser offline, a cache miss behind a proxy, an
 * asset that never shipped. That is not fatal here. `ready()` resolves
 * to `null` and the avatar keeps the untextured silhouette it stands up
 * with, so a player who cannot see the character still sees an opponent.
 *
 * The asset is `public/models/robot.glb`, CC0 1.0. See the README beside
 * it for provenance.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneRigged } from "three/examples/jsm/utils/SkeletonUtils.js";

import { disposeObject } from "./dispose";

/** What the game asks a character to do. The names on the right are the
 * asset's own clip names, and they are the only place the asset's
 * vocabulary is spoken: everything downstream asks for a role. */
const CLIP_BY_ROLE = {
    idle: "Idle",
    walk: "Walking",
    run: "Running",
    death: "Death",
    fire: "Punch",
} as const;

export type ClipRole = keyof typeof CLIP_BY_ROLE;

const MODEL_URL = `${import.meta.env.BASE_URL}models/robot.glb`;

/** The material the asset paints the character's body panels with. It
 * is the one that carries team colour; the rest stay as authored. */
const BODY_MATERIAL = "Main";

export interface CharacterInstance {
    /** Scaled to the game's player height and facing -Z, as the yaw
     * convention in `movement` expects. */
    root: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    /** Every material this instance alone owns, for damage flashes. */
    materials: THREE.MeshStandardMaterial[];
    action(role: ClipRole): THREE.AnimationAction;
    dispose(): void;
}

export class CharacterLibrary {
    private loading: Promise<void> | null = null;
    private source: THREE.Object3D | null = null;
    private clips = new Map<ClipRole, THREE.AnimationClip>();
    private modelScale = 1;
    private disposed = false;

    constructor(private readonly playerHeight: number) {}

    /** Resolves once the asset is in hand, or to `null` if it is not
     * coming. Safe to call from every avatar; the fetch happens once. */
    async ready(): Promise<CharacterLibrary | null> {
        if (!this.loading) this.loading = this.load();
        await this.loading;
        return this.source ? this : null;
    }

    /** True once a real model is available to clone. */
    get loaded(): boolean {
        return this.source !== null;
    }

    create(team: THREE.Color): CharacterInstance | null {
        if (!this.source) return null;
        const root = cloneRigged(this.source);
        root.scale.setScalar(this.modelScale);

        const materials: THREE.MeshStandardMaterial[] = [];
        root.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // A skinned mesh's bounds are computed in bind pose, so an
            // arm thrown out of it culls the hand mid-animation.
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
            const source = mesh.material;
            if (Array.isArray(source)) return;
            const material = (source as THREE.MeshStandardMaterial).clone();
            if (material.name === BODY_MATERIAL) material.color.copy(team);
            mesh.material = material;
            materials.push(material);
        });

        const mixer = new THREE.AnimationMixer(root);
        const actions = new Map<ClipRole, THREE.AnimationAction>();
        for (const [role, clip] of this.clips) {
            actions.set(role, mixer.clipAction(clip));
        }

        return {
            root,
            mixer,
            materials,
            action: (role) => {
                const found = actions.get(role);
                if (!found) throw new Error(`character clip missing: ${role}`);
                return found;
            },
            dispose: () => {
                mixer.stopAllAction();
                mixer.uncacheRoot(root);
                for (const material of materials) material.dispose();
                root.removeFromParent();
            },
        };
    }

    dispose(): void {
        this.disposed = true;
        if (!this.source) return;
        disposeObject(this.source);
        this.source = null;
        this.clips.clear();
    }

    private async load(): Promise<void> {
        const gltf = await new GLTFLoader().loadAsync(MODEL_URL).catch(() => null);
        if (!gltf) return;
        if (this.disposed) {
            disposeObject(gltf.scene);
            return;
        }

        const byName = new Map(gltf.animations.map((clip) => [clip.name, clip]));
        for (const role of Object.keys(CLIP_BY_ROLE) as ClipRole[]) {
            const clip = byName.get(CLIP_BY_ROLE[role]);
            if (!clip) continue;
            if (role === "death") this.clips.set(role, trimClosingFrame(clip));
            else if (role === "fire") this.clips.set(role, asAdditive(clip));
            else this.clips.set(role, clip);
        }
        // A body with no way to stand still is not a character.
        if (!this.clips.has("idle")) {
            disposeObject(gltf.scene);
            return;
        }

        this.modelScale = this.playerHeight / measureHeight(gltf.scene);
        this.source = gltf.scene;
    }
}

/** How tall the asset stands in its own units, so the game can scale it
 * to the height the simulation gives a player. Measured rather than
 * written down, so swapping the asset does not leave a stale number. */
function measureHeight(root: THREE.Object3D): number {
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const height = bounds.max.y - bounds.min.y;
    return height > 0.01 ? height : 1;
}

/* A clip exported to loop repeats its opening pose in the final key. A
 * death animation clamped on that key stands the corpse straight back
 * up, so the closing frame goes and the pose the body settled into is
 * the one that holds. */
function trimClosingFrame(clip: THREE.AnimationClip): THREE.AnimationClip {
    let keys = 0;
    for (const track of clip.tracks) keys = Math.max(keys, track.times.length);
    if (keys < 3 || clip.duration <= 0) return clip;
    const fps = (keys - 1) / clip.duration;
    return THREE.AnimationUtils.subclip(clip, clip.name, 0, keys - 2, fps);
}

/* Firing is a jolt on top of whatever the body is already doing, not a
 * replacement for it: an additive clip carries only the difference from
 * its own opening pose, so a player can flinch through a shot without
 * their legs stopping mid-stride. */
function asAdditive(clip: THREE.AnimationClip): THREE.AnimationClip {
    return THREE.AnimationUtils.makeClipAdditive(clip.clone());
}
