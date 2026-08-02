/* The holder's own view.
 *
 * ADR-0002 puts the camera inside the player's head and leaves their
 * body unrendered, which settles what other people see. It leaves open
 * what the holder sees, and the answer cannot be "nothing": a shooter
 * where firing moves no object on screen reads as a broken button.
 *
 * So the holder sees the weapon they are carrying. It is not the
 * avatar, and it is not in the arena: it lives in its own scene, drawn
 * in a second pass over a cleared depth buffer. That is what stops a
 * gun held forty centimetres from the eye from disappearing into every
 * wall the player stands next to, and it is why the arena's fog and
 * lighting cannot wash it out.
 *
 * The weapon is where the game's rhythm is read: it sways behind the
 * aim, it bobs at the rate the player is actually moving, it kicks on
 * every round and settles between them, and it drops out of the way
 * while the magazine is being changed. None of that is decoration. Each
 * one answers a question the player would otherwise have to read off
 * the HUD.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";
import { Spring } from "./spring";
import { createGlowMask, createVignetteMask } from "./textures";
import { buildWeapon, type WeaponRig } from "./weapon";

const FIELD_OF_VIEW = 48;
const NEAR = 0.01;
const FAR = 6;

/* Where the weapon rests in the view: to the right, below the aim, and
 * far enough forward that it reads as a rifle pointing down the
 * sightline. Held closer it fills the corner of the screen with the
 * back of itself, which is a stack of boxes rather than a weapon. */
const REST = new THREE.Vector3(0.25, -0.22, -0.6);
const REST_YAW = -0.13;

/** Metres of stride per full bob cycle. Deriving the cycle from ground
 * covered rather than from time is what keeps the bob in step with the
 * feet when the player's speed changes. */
const BOB_METRES = 1.7;
const BOB_SIDEWAYS = 0.016;
const BOB_VERTICAL = 0.02;

/** How far the weapon trails a turn, and how fast it catches up. */
const SWAY_LIMIT = 0.09;
const SWAY_TRACKING = 9;

const RECOIL_STIFFNESS = 240;
const RECOIL_DAMPING = 22;
const RECOIL_KICK = 2.6;

/** Where the weapon goes while the magazine is out, and how briskly. */
const RELOAD_PITCH = -0.85;
const RELOAD_DROP = 0.14;
const RELOAD_TRACKING = 7;

const MUZZLE_SECONDS = 0.06;
const MUZZLE_SIZE = 0.17;
const VIGNETTE_SECONDS = 0.55;
const VIGNETTE_OPACITY = 0.85;
const VIGNETTE_DISTANCE = 0.06;

export class FirstPerson {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(
        FIELD_OF_VIEW,
        1,
        NEAR,
        FAR,
    );
    private readonly rig = new THREE.Group();
    private readonly weapon: WeaponRig;
    private readonly flash: THREE.Mesh;
    private readonly flashMaterial: THREE.MeshBasicMaterial;
    private readonly vignette: THREE.Mesh;
    private readonly vignetteMaterial: THREE.MeshBasicMaterial;
    private readonly glow = createGlowMask();
    private readonly frame = createVignetteMask();

    private readonly recoil = new Spring(RECOIL_STIFFNESS, RECOIL_DAMPING);
    private bobPhase = 0;
    private sway = 0;
    private swayPitch = 0;
    private reloadPose = 0;
    private flashLife = 0;
    private hurt = 0;
    private aspect = 1;

    constructor(private motionReduced: boolean) {
        this.scene.name = "first-person";
        this.camera.name = "first-person-camera";
        this.scene.add(this.camera);

        // Its own light, because the arena's is a scene away and a
        // weapon lit by nothing is a silhouette.
        this.scene.add(
            new THREE.HemisphereLight(
                new THREE.Color(SCENE_COLORS.arenaSky),
                new THREE.Color(SCENE_COLORS.arenaGround),
                1.4,
            ),
        );
        const key = new THREE.DirectionalLight(
            new THREE.Color(SCENE_COLORS.bg),
            1.6,
        );
        key.position.set(-0.6, 1, 0.7);
        this.scene.add(key);

        this.weapon = buildWeapon(SCENE_COLORS.primary);
        this.rig.add(this.weapon.root);
        this.rig.position.copy(REST);
        this.rig.rotation.y = REST_YAW;
        this.camera.add(this.rig);

        this.flashMaterial = new THREE.MeshBasicMaterial({
            map: this.glow,
            color: SCENE_COLORS.muzzleFlash,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        this.flash = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.flashMaterial,
        );
        this.flash.position.copy(this.weapon.muzzle.position);
        this.flash.visible = false;
        this.rig.add(this.flash);

        this.vignetteMaterial = new THREE.MeshBasicMaterial({
            map: this.frame,
            color: SCENE_COLORS.destructive,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        });
        this.vignette = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.vignetteMaterial,
        );
        this.vignette.position.set(0, 0, -VIGNETTE_DISTANCE);
        this.vignette.renderOrder = 10;
        this.vignette.visible = false;
        this.camera.add(this.vignette);
        this.resize(1);
    }

    resize(aspect: number): void {
        this.aspect = aspect;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        // Cover exactly what the view covers at the depth it sits at.
        const height =
            2 * VIGNETTE_DISTANCE * Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
        this.vignette.scale.set(height * this.aspect, height, 1);
    }

    /** Drive the weapon from what the player is doing this frame.
     * `speed` is metres a second over the ground; the look deltas are
     * radians turned since the last frame. */
    update(
        dt: number,
        speed: number,
        reloading: boolean,
        alive: boolean,
        yawDelta: number,
        pitchDelta: number,
    ): void {
        this.rig.visible = alive;

        const amplitude = this.motionReduced ? 0.35 : 1;
        this.bobPhase += (speed * dt * Math.PI * 2) / BOB_METRES;
        const bobX = Math.sin(this.bobPhase) * BOB_SIDEWAYS * amplitude;
        const bobY = -Math.abs(Math.cos(this.bobPhase)) * BOB_VERTICAL * amplitude;

        const swayTarget = clamp(-yawDelta * 2.2, -SWAY_LIMIT, SWAY_LIMIT);
        const swayPitchTarget = clamp(-pitchDelta * 2.2, -SWAY_LIMIT, SWAY_LIMIT);
        const tracking = Math.min(1, SWAY_TRACKING * dt);
        this.sway += (swayTarget - this.sway) * tracking;
        this.swayPitch += (swayPitchTarget - this.swayPitch) * tracking;

        this.recoil.update(dt);

        this.reloadPose +=
            ((reloading ? 1 : 0) - this.reloadPose) * Math.min(1, RELOAD_TRACKING * dt);

        const kick = this.recoil.value;
        this.rig.position.set(
            REST.x + bobX + this.sway,
            REST.y + bobY + this.swayPitch - this.reloadPose * RELOAD_DROP,
            REST.z + kick * 0.06,
        );
        this.rig.rotation.set(
            kick * 0.5 + this.reloadPose * RELOAD_PITCH + this.swayPitch * 1.5,
            REST_YAW + this.sway * 1.8,
            this.reloadPose * 0.5,
        );

        if (this.flashLife > 0) {
            this.flashLife -= dt;
            const remaining = Math.max(0, this.flashLife / MUZZLE_SECONDS);
            this.flash.visible = remaining > 0;
            this.flash.scale.setScalar(MUZZLE_SIZE * (0.5 + remaining));
            this.flash.rotation.z += dt * 30;
        }

        if (this.hurt > 0) {
            this.hurt = Math.max(0, this.hurt - dt / VIGNETTE_SECONDS);
            this.vignetteMaterial.opacity = this.hurt * this.hurt * VIGNETTE_OPACITY;
            this.vignette.visible = this.hurt > 0;
        }
    }

    /** One round left the barrel. */
    fire(): void {
        this.recoil.kick(RECOIL_KICK);
        this.flashLife = MUZZLE_SECONDS;
        this.flash.visible = true;
        this.flash.rotation.z = Math.random() * Math.PI;
    }

    /** The player took a hit. `severity` is 0 to 1. */
    damaged(severity: number): void {
        this.hurt = Math.min(1, this.hurt + severity);
    }

    /** Where the weapon's muzzle is in the arena's own space, so a
     * tracer drawn in the arena starts at the gun the player can see. */
    muzzleWorld(target: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 {
        this.rig.updateWorldMatrix(true, true);
        camera.updateWorldMatrix(true, false);
        // The layer camera sits at the origin unrotated, so a point in
        // its scene is already in the arena camera's own space.
        return this.weapon.muzzle
            .getWorldPosition(target)
            .applyMatrix4(camera.matrixWorld);
    }

    setMotionReduced(reduced: boolean): void {
        this.motionReduced = reduced;
    }

    /** Draw over the arena, on a depth buffer of its own. */
    render(renderer: THREE.WebGLRenderer): void {
        renderer.clearDepth();
        renderer.render(this.scene, this.camera);
    }

    dispose(): void {
        this.weapon.dispose();
        this.flash.geometry.dispose();
        this.flashMaterial.dispose();
        this.vignette.geometry.dispose();
        this.vignetteMaterial.dispose();
        this.glow.dispose();
        this.frame.dispose();
        this.scene.clear();
    }
}

function clamp(value: number, low: number, high: number): number {
    return value < low ? low : value > high ? high : value;
}
