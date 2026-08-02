/* What a shot leaves behind.
 *
 * A hitscan weapon has no projectile to watch: the server resolves the
 * ray the instant the trigger goes down, so unless the client draws
 * something, firing is a number changing on a HUD. The four things
 * drawn here are what make a shot an event, and each answers a
 * different question a player is asking:
 *
 *  - the flash says *I fired*,
 *  - the tracer says *that way*,
 *  - the impact says *and it landed there*,
 *  - the hole it leaves says *this is where I have already been*.
 *
 * Everything is pooled and nothing is allocated after construction. A
 * pool that runs dry recycles its oldest member rather than dropping
 * the new one, because the shot a player just took is the one they are
 * watching.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";
import { ParticleSystem } from "./Particles";
import { createGlowMask, createImpactMask } from "./textures";

const TRACER_POOL = 24;
const TRACER_SECONDS = 0.09;
const TRACER_RADIUS = 0.022;
const FLASH_POOL = 12;
const FLASH_SECONDS = 0.075;
const MUZZLE_FLASH_SIZE = 0.5;
const IMPACT_FLASH_SIZE = 0.4;
const DECAL_POOL = 40;
const DECAL_SECONDS = 9;
const DECAL_FADE_SECONDS = 1.2;
const DECAL_SIZE = 0.34;
/** Lifted off the surface it marks, or it fights with it for the pixel. */
const DECAL_LIFT = 0.014;
const UP = new THREE.Vector3(0, 1, 0);
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const scratchDirection = new THREE.Vector3();

interface Timed {
    readonly object: THREE.Object3D;
    life: number;
    /* A flash and a tracer are shorter than a frame on a slow machine,
     * so an effect that expired purely on elapsed time could be spawned
     * and retired between two draws and never appear at all. Ageing
     * starts only once the effect has survived to a draw, which costs a
     * frame of extra life at sixty and is the difference between seeing
     * your own shot and not at eight. */
    drawn: boolean;
}

export class Effects {
    readonly particles: ParticleSystem;

    private readonly glow = createGlowMask();
    private readonly hole = createImpactMask();
    private readonly root = new THREE.Group();

    private readonly tracers: Timed[] = [];
    private readonly muzzleFlashes: Timed[] = [];
    private readonly impactFlashes: Timed[] = [];
    private readonly decals: Timed[] = [];
    private nextTracer = 0;
    private nextMuzzle = 0;
    private nextImpact = 0;
    private nextDecal = 0;

    private readonly tracerGeometry: THREE.BufferGeometry;
    private readonly flashGeometry: THREE.BufferGeometry;
    private readonly decalGeometry: THREE.BufferGeometry;
    private readonly materials: THREE.Material[] = [];

    constructor(
        scene: THREE.Scene,
        private readonly camera: THREE.Camera,
    ) {
        this.root.name = "effects";
        scene.add(this.root);
        this.particles = new ParticleSystem(scene);

        // The cylinder is modelled from its base along +Y so a tracer is
        // placed at the muzzle and stretched to the impact, rather than
        // placed at a midpoint that has to be computed every shot.
        this.tracerGeometry = new THREE.CylinderGeometry(
            TRACER_RADIUS,
            TRACER_RADIUS,
            1,
            5,
            1,
            true,
        );
        this.tracerGeometry.translate(0, 0.5, 0);
        this.flashGeometry = new THREE.PlaneGeometry(1, 1);
        this.decalGeometry = new THREE.PlaneGeometry(1, 1);

        const tracerMaterial = this.own(
            new THREE.MeshBasicMaterial({
                color: SCENE_COLORS.bullet,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }),
        );
        const muzzleMaterial = this.own(
            new THREE.MeshBasicMaterial({
                map: this.glow,
                color: SCENE_COLORS.muzzleFlash,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }),
        );
        const impactMaterial = this.own(
            new THREE.MeshBasicMaterial({
                map: this.glow,
                color: SCENE_COLORS.hitIndicator,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }),
        );
        const decalMaterial = this.own(
            new THREE.MeshBasicMaterial({
                map: this.hole,
                color: SCENE_COLORS.fg,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                polygonOffsetUnits: -4,
            }),
        );

        fill(this.tracers, TRACER_POOL, this.root, this.tracerGeometry, tracerMaterial);
        fill(this.muzzleFlashes, FLASH_POOL, this.root, this.flashGeometry, muzzleMaterial);
        fill(this.impactFlashes, FLASH_POOL, this.root, this.flashGeometry, impactMaterial);
        fill(this.decals, DECAL_POOL, this.root, this.decalGeometry, decalMaterial);
    }

    /** A shot fired from `from` that ended at `to`. */
    tracer(from: THREE.Vector3, to: THREE.Vector3): void {
        const distance = from.distanceTo(to);
        if (distance < 0.01) return;
        scratchDirection.subVectors(to, from).divideScalar(distance);
        const slot = this.tracers[this.nextTracer];
        this.nextTracer = (this.nextTracer + 1) % TRACER_POOL;
        slot.object.position.copy(from);
        slot.object.quaternion.setFromUnitVectors(UP, scratchDirection);
        slot.object.scale.set(1, distance, 1);
        slot.object.visible = true;
        slot.life = TRACER_SECONDS;
        slot.drawn = false;
    }

    /** The flash at somebody else's muzzle: a card facing the viewer,
     * and the sparks thrown along the shot. */
    muzzleFlash(at: THREE.Vector3, forward: THREE.Vector3): void {
        const slot = this.muzzleFlashes[this.nextMuzzle];
        this.nextMuzzle = (this.nextMuzzle + 1) % FLASH_POOL;
        slot.object.position.copy(at);
        slot.object.scale.setScalar(MUZZLE_FLASH_SIZE);
        slot.object.visible = true;
        slot.life = FLASH_SECONDS;
        slot.drawn = false;
        this.particles.muzzleFlash(at, forward);
    }

    /** The holder's own muzzle. The flash card for it is drawn in their
     * own view, so what the arena gets is the sparks it kicks out. */
    holderMuzzle(at: THREE.Vector3, forward: THREE.Vector3): void {
        this.particles.muzzleFlash(at, forward);
    }

    /** A shot landing on the world: a flash, sparks, and a hole. */
    impact(point: THREE.Vector3, normal: THREE.Vector3): void {
        const flash = this.impactFlashes[this.nextImpact];
        this.nextImpact = (this.nextImpact + 1) % FLASH_POOL;
        flash.object.position.copy(point);
        flash.object.scale.setScalar(IMPACT_FLASH_SIZE);
        flash.object.visible = true;
        flash.life = FLASH_SECONDS;
        flash.drawn = false;

        const decal = this.decals[this.nextDecal];
        this.nextDecal = (this.nextDecal + 1) % DECAL_POOL;
        decal.object.position.copy(point).addScaledVector(normal, DECAL_LIFT);
        decal.object.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
        // A wall of identical holes reads as a texture, not as damage.
        decal.object.rotateZ(Math.random() * Math.PI * 2);
        decal.object.scale.setScalar(DECAL_SIZE);
        decal.object.visible = true;
        decal.life = DECAL_SECONDS;
        decal.drawn = true;

        this.particles.impact(point, normal);
    }

    /** A shot landing on a player. */
    bodyImpact(point: THREE.Vector3): void {
        const flash = this.impactFlashes[this.nextImpact];
        this.nextImpact = (this.nextImpact + 1) % FLASH_POOL;
        flash.object.position.copy(point);
        flash.object.scale.setScalar(IMPACT_FLASH_SIZE);
        flash.object.visible = true;
        flash.life = FLASH_SECONDS;
        flash.drawn = false;
        this.particles.hit(point);
    }

    update(dt: number): void {
        for (const slot of this.tracers) {
            if (slot.life <= 0) continue;
            if (!slot.drawn) {
                slot.drawn = true;
                continue;
            }
            slot.life -= dt;
            if (slot.life <= 0) {
                slot.object.visible = false;
                continue;
            }
            // A tracer thins rather than fades: the material is shared
            // by the whole pool, so opacity is not one shot's to move.
            const remaining = slot.life / TRACER_SECONDS;
            slot.object.scale.x = remaining;
            slot.object.scale.z = remaining;
        }

        this.decayFlashes(this.muzzleFlashes, MUZZLE_FLASH_SIZE, dt);
        this.decayFlashes(this.impactFlashes, IMPACT_FLASH_SIZE, dt);

        for (const slot of this.decals) {
            if (slot.life <= 0) continue;
            slot.life -= dt;
            if (slot.life <= 0) {
                slot.object.visible = false;
                continue;
            }
            if (slot.life < DECAL_FADE_SECONDS) {
                slot.object.scale.setScalar(
                    DECAL_SIZE * (slot.life / DECAL_FADE_SECONDS),
                );
            }
        }

        this.particles.update(dt);
    }

    /** Tracers currently drawn. */
    tracerCount(): number {
        return countLive(this.tracers);
    }

    /** Bullet holes currently on the world. */
    decalCount(): number {
        return countLive(this.decals);
    }

    dispose(): void {
        this.particles.dispose();
        this.root.removeFromParent();
        this.root.clear();
        this.tracerGeometry.dispose();
        this.flashGeometry.dispose();
        this.decalGeometry.dispose();
        for (const material of this.materials) material.dispose();
        this.glow.dispose();
        this.hole.dispose();
    }

    private decayFlashes(pool: Timed[], size: number, dt: number): void {
        for (const slot of pool) {
            if (slot.life <= 0) continue;
            // Face the viewer: a flat card seen edge on is not a flash.
            slot.object.quaternion.copy(this.camera.quaternion);
            if (!slot.drawn) {
                slot.drawn = true;
                continue;
            }
            slot.life -= dt;
            if (slot.life <= 0) {
                slot.object.visible = false;
                continue;
            }
            const remaining = slot.life / FLASH_SECONDS;
            slot.object.scale.setScalar(size * (0.6 + remaining * 0.6));
        }
    }

    private own<T extends THREE.Material>(material: T): T {
        this.materials.push(material);
        return material;
    }
}

function fill(
    pool: Timed[],
    count: number,
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
): void {
    for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        parent.add(mesh);
        pool.push({ object: mesh, life: 0, drawn: true });
    }
}

function countLive(pool: Timed[]): number {
    let live = 0;
    for (const slot of pool) if (slot.life > 0) live++;
    return live;
}
