/* Particle system. Used for muzzle flash and hit particles.
 * Particles are small instanced meshes (THREE.SphereGeometry) with
 * per-particle position + velocity + lifetime. The pool is pre-allocated.
 */

import * as THREE from "three";
import { SCENE_COLORS } from "../brand/tokens";

const POOL_SIZE = 64;

interface Particle {
    active: boolean;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
}

export class ParticleSystem {
    private particles: Particle[] = [];
    private mesh: THREE.InstancedMesh;
    private dummy: THREE.Object3D = new THREE.Object3D();
    private color: THREE.Color = new THREE.Color();

    constructor(scene: THREE.Scene) {
        const geo = new THREE.SphereGeometry(0.08, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: SCENE_COLORS.muzzleFlash,
            transparent: true,
            opacity: 0.9,
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, POOL_SIZE);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.mesh);
        for (let i = 0; i < POOL_SIZE; i++) {
            this.particles.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
            });
        }
    }

    private spawn(position: THREE.Vector3, velocity: THREE.Vector3, life: number, hex: string): boolean {
        for (const p of this.particles) {
            if (!p.active) {
                p.active = true;
                p.position.copy(position);
                p.velocity.copy(velocity);
                p.life = life;
                p.maxLife = life;
                this.color.set(hex);
                return true;
            }
        }
        return false;
    }

    muzzleFlash(position: THREE.Vector3, forward: THREE.Vector3): void {
        for (let i = 0; i < 6; i++) {
            const v = forward
                .clone()
                .multiplyScalar(2 + Math.random() * 2)
                .add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.4,
                        (Math.random() - 0.5) * 0.4,
                        (Math.random() - 0.5) * 0.4,
                    ),
                );
            this.spawn(position, v, 0.1, SCENE_COLORS.muzzleFlash);
        }
    }

    hit(position: THREE.Vector3): void {
        for (let i = 0; i < 12; i++) {
            const v = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 2,
                (Math.random() - 0.5) * 3,
            );
            this.spawn(position, v, 0.4, SCENE_COLORS.hitIndicator);
        }
    }

    update(dt: number): void {
        for (const p of this.particles) {
            if (!p.active) {
                this.dummy.position.set(0, -1000, 0);
                this.dummy.scale.set(0, 0, 0);
                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(this.particles.indexOf(p), this.dummy.matrix);
                continue;
            }
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }
            p.position.addScaledVector(p.velocity, dt);
            p.velocity.y -= 4 * dt;
            const t = p.life / p.maxLife;
            this.dummy.position.copy(p.position);
            this.dummy.scale.setScalar(t);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(this.particles.indexOf(p), this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    /** Returns the count of live particles, for INT-016 assertion. */
    liveCount(): number {
        return this.particles.filter((p) => p.active).length;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.removeFromParent();
    }
}
