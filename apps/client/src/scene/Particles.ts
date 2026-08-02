/* Sparks.
 *
 * One instanced mesh draws the whole pool in a single call, and the
 * pool is allocated once at construction: a shot that had to allocate
 * would stutter the frame it landed on, which is the frame a player is
 * paying the most attention to.
 *
 * Every particle carries its own colour, because the same pool serves a
 * muzzle flash and an impact and those are not the same colour. Colour
 * comes from `SCENE_COLORS`; nothing here names a value.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";

const POOL_SIZE = 192;
/** Metres a second, downward. Lighter than the world's gravity: sparks
 * are small and hot and should hang long enough to be read. */
const GRAVITY = 7.0;
/** Fraction of speed shed per second, so a burst decays into a drift. */
const DRAG = 2.6;

interface Particle {
    life: number;
    maxLife: number;
    size: number;
    readonly position: THREE.Vector3;
    readonly velocity: THREE.Vector3;
}

const scratchColor = new THREE.Color();
const scratchDirection = new THREE.Vector3();
const scratchAxis = new THREE.Vector3();

export class ParticleSystem {
    private readonly particles: Particle[] = [];
    private readonly mesh: THREE.InstancedMesh;
    private readonly dummy = new THREE.Object3D();
    private next = 0;

    constructor(scene: THREE.Scene) {
        const geometry = new THREE.SphereGeometry(0.05, 5, 4);
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.mesh = new THREE.InstancedMesh(geometry, material, POOL_SIZE);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(POOL_SIZE * 3),
            3,
        );
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        // The pool spans the arena, so a per-instance bounding volume
        // would cull the whole draw whenever the centre left the view.
        this.mesh.frustumCulled = false;
        this.mesh.name = "particles";
        scene.add(this.mesh);

        for (let i = 0; i < POOL_SIZE; i++) {
            this.particles.push({
                life: 0,
                maxLife: 0,
                size: 1,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
            });
        }
        this.hideAll();
    }

    /** The flash at a barrel: fast, short, thrown along the shot. */
    muzzleFlash(position: THREE.Vector3, forward: THREE.Vector3): void {
        for (let i = 0; i < 5; i++) {
            scratchDirection
                .copy(forward)
                .multiplyScalar(3 + Math.random() * 3)
                .addScaledVector(scatter(scratchAxis), 1.4);
            this.spawn(position, scratchDirection, 0.09, 0.9, SCENE_COLORS.muzzleFlash);
        }
    }

    /** The burst where a shot landed, thrown back out of the surface. */
    impact(position: THREE.Vector3, normal: THREE.Vector3): void {
        for (let i = 0; i < 10; i++) {
            scratchDirection
                .copy(normal)
                .multiplyScalar(1.5 + Math.random() * 3)
                .addScaledVector(scatter(scratchAxis), 2.2);
            this.spawn(
                position,
                scratchDirection,
                0.25 + Math.random() * 0.3,
                0.55,
                SCENE_COLORS.hitIndicator,
            );
        }
    }

    /** The burst where a shot landed on somebody. */
    hit(position: THREE.Vector3): void {
        for (let i = 0; i < 14; i++) {
            scratchDirection.copy(scatter(scratchAxis)).multiplyScalar(2.4);
            scratchDirection.y += 1.4;
            this.spawn(
                position,
                scratchDirection,
                0.3 + Math.random() * 0.25,
                0.8,
                SCENE_COLORS.destructive,
            );
        }
    }

    update(dt: number): void {
        for (let i = 0; i < POOL_SIZE; i++) {
            const particle = this.particles[i];
            if (particle.life <= 0) continue;
            particle.life -= dt;
            if (particle.life <= 0) {
                this.hide(i);
                continue;
            }
            particle.velocity.y -= GRAVITY * dt;
            particle.velocity.multiplyScalar(Math.max(0, 1 - DRAG * dt));
            particle.position.addScaledVector(particle.velocity, dt);

            const remaining = particle.life / particle.maxLife;
            this.dummy.position.copy(particle.position);
            this.dummy.scale.setScalar(particle.size * remaining);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    /** Live particles. A shot that spawned none produced nothing. */
    liveCount(): number {
        let live = 0;
        for (const particle of this.particles) if (particle.life > 0) live++;
        return live;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.removeFromParent();
        this.mesh.dispose();
    }

    /* The pool is a ring: when it is full the oldest particle is taken
     * rather than the burst being dropped, so a firefight thins out
     * evenly instead of the last shot producing nothing at all. */
    private spawn(
        position: THREE.Vector3,
        velocity: THREE.Vector3,
        life: number,
        size: number,
        hex: string,
    ): void {
        const index = this.next;
        this.next = (this.next + 1) % POOL_SIZE;
        const particle = this.particles[index];
        particle.position.copy(position);
        particle.velocity.copy(velocity);
        particle.life = life;
        particle.maxLife = life;
        particle.size = size;
        this.mesh.setColorAt(index, scratchColor.set(hex));
    }

    private hide(index: number): void {
        this.dummy.position.set(0, 0, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    private hideAll(): void {
        for (let i = 0; i < POOL_SIZE; i++) this.hide(i);
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

/** A unit-ish vector in a random direction, into the caller's scratch. */
function scatter(target: THREE.Vector3): THREE.Vector3 {
    return target.set(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
    );
}
