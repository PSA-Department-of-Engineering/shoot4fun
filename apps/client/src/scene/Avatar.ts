/* One other player, with a body.
 *
 * The avatar is driven entirely by what arrives over the wire, and the
 * wire carries no velocity: a snapshot says where a player is, not how
 * fast they are going. So locomotion is *derived*, by measuring how far
 * the interpolated position moved this frame. That measurement is the
 * only input the state machine needs to tell standing from walking from
 * running, and it stays correct if the server ever changes what a
 * player's speed is, because it never assumed one.
 *
 * The states are idle, walk, run and dead, and every transition is a
 * crossfade rather than a cut. Firing is not a state: it is an additive
 * jolt layered over whichever of the four is running, so a player can
 * shoot without their legs stopping.
 *
 * The local player has no avatar. The camera is inside their head
 * (`ADR-0002`), so this class is only ever used for other people.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";
import { MOVE_SPEED, PLAYER_RADIUS } from "../sim/movement";
import { CharacterLibrary, type CharacterInstance, type ClipRole } from "./CharacterLibrary";
import { disposeObject } from "./dispose";
import { SHOT_LAYER } from "./ShotRay";
import { buildWeapon, type WeaponRig } from "./weapon";

export type AvatarMotion = "idle" | "walk" | "run" | "dead";

/** Ground covered in one frame that no stride explains. A respawn puts
 * a player across the arena between two frames; treating that as speed
 * would break a sprint animation out of a standing start. */
const TELEPORT_METRES = 2.0;

/* Speeds the state machine changes gait at, in metres a second. Each
 * boundary is two numbers, not one: a player travelling at exactly the
 * threshold would otherwise flip between two clips every frame, and a
 * body that alternates walk and run twenty times a second reads as a
 * glitch rather than as movement. */
const WALK_ENTER = 0.4;
const WALK_LEAVE = 0.2;
const RUN_ENTER = 3.4;
const RUN_LEAVE = 2.6;
/** How fast the measured speed catches up with the truth, per second.
 * Interpolation makes the raw delta jitter; the animation must not. */
const SPEED_TRACKING = 14.0;
const CROSSFADE_SECONDS = 0.18;

/** The stride the walk and run clips were authored at, as a fraction of
 * the game's own speed. Playing them off it is what stops the feet
 * skating over the ground. */
const WALK_REFERENCE = MOVE_SPEED * 0.5;
const FIRE_TIME_SCALE = 2.2;
const FIRE_WEIGHT = 0.85;

const DAMAGE_FLASH_SECONDS = 0.22;
const DAMAGE_FLASH_PEAK = 0.55;
const CORPSE_HOLD_SECONDS = 1.9;
const CORPSE_SINK_SECONDS = 0.7;
const CORPSE_SINK_METRES = 1.5;
const SPAWN_POP_SECONDS = 0.3;

/* Where the weapon rides on the body: on the carrier's right, at the
 * height a shoulder-slung rifle sits. Right is +X at yaw zero, the same
 * convention `movement` strafes by. */
const WEAPON_OFFSET = new THREE.Vector3(0.3, 0.98, -0.18);

export class Avatar {
    readonly group = new THREE.Group();

    private instance: CharacterInstance | null = null;
    private placeholder: THREE.Group | null = null;
    private readonly weapon: WeaponRig;
    private readonly proxy: THREE.Mesh;
    private readonly teamColor: THREE.Color;

    private motion: AvatarMotion = "idle";
    private current: THREE.AnimationAction | null = null;
    private speed = 0;
    private alive = true;
    private feetY = 0;
    private deadFor = 0;
    private spawnedFor = 0;
    private flash = 0;
    private disposed = false;
    private readonly previous = new THREE.Vector3();

    constructor(
        parent: THREE.Object3D,
        library: CharacterLibrary,
        team: number,
        height: number,
    ) {
        this.teamColor = new THREE.Color(
            team === 2 ? SCENE_COLORS.team2 : SCENE_COLORS.team1,
        );
        this.group.name = "avatar";
        parent.add(this.group);

        this.placeholder = buildSilhouette(this.teamColor, height);
        this.group.add(this.placeholder);

        this.weapon = buildWeapon(this.teamColor);
        this.weapon.root.position.copy(WEAPON_OFFSET);
        this.group.add(this.weapon.root);

        /* An invisible stand-in for the body, so a shot can be stopped
         * by a player rather than punching through them and leaving a
         * bullet hole on the wall behind. It is never drawn. */
        this.proxy = new THREE.Mesh(
            new THREE.CapsuleGeometry(PLAYER_RADIUS, height - PLAYER_RADIUS * 2, 4, 8),
        );
        this.proxy.name = "body";
        this.proxy.userData.body = true;
        this.proxy.position.y = height / 2;
        this.proxy.visible = false;
        this.proxy.layers.set(SHOT_LAYER);
        this.group.add(this.proxy);

        void library.ready().then((ready) => {
            if (!ready || this.disposed) return;
            this.adopt(ready);
        });
    }

    /** Place the avatar as of this frame. Everything else is derived. */
    setPose(
        x: number,
        y: number,
        z: number,
        yaw: number,
        pitch: number,
        alive: boolean,
    ): void {
        this.feetY = y;
        this.group.position.set(x, y, z);
        this.group.rotation.y = yaw;
        // Only the weapon carries aim: pitching the whole body would
        // lean a running character into the floor.
        this.weapon.root.rotation.x = pitch;
        if (alive !== this.alive) this.setAlive(alive);
    }

    update(dt: number): void {
        if (dt <= 0) return;

        const travelled = Math.hypot(
            this.group.position.x - this.previous.x,
            this.group.position.z - this.previous.z,
        );
        this.previous.copy(this.group.position);
        const measured = travelled > TELEPORT_METRES ? 0 : travelled / dt;
        this.speed += (measured - this.speed) * Math.min(1, SPEED_TRACKING * dt);

        if (this.alive) {
            this.play(this.gaitFor(this.speed));
            this.driveStride();
            this.driveSpawnPop(dt);
        } else {
            this.deadFor += dt;
            this.driveCorpse();
        }

        this.driveFlash(dt);
        this.instance?.mixer.update(dt);
    }

    /** A shot left this body. Layered over whatever it is doing. */
    fire(): void {
        // A round can be reported a moment after the body that spent it
        // was seen to fall, and a corpse must not flinch.
        if (!this.alive) return;
        const action = this.action("fire");
        if (!action) return;
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.timeScale = FIRE_TIME_SCALE;
        action.setEffectiveWeight(FIRE_WEIGHT);
        action.play();
    }

    /** A shot landed on this body. */
    takeDamage(): void {
        this.flash = 1;
    }

    /** The point a shot appears to leave from, in world space. */
    muzzlePoint(target: THREE.Vector3): THREE.Vector3 {
        return this.weapon.muzzle.getWorldPosition(target);
    }

    /** The shot origin the server used: the eye, not the gun. */
    eyePoint(target: THREE.Vector3, eyeHeight: number): THREE.Vector3 {
        return target.set(
            this.group.position.x,
            this.group.position.y + eyeHeight,
            this.group.position.z,
        );
    }

    /** Which way this player is looking, from the aim the weapon carries. */
    lookDirection(target: THREE.Vector3): THREE.Vector3 {
        const pitch = this.weapon.root.rotation.x;
        const yaw = this.group.rotation.y;
        const cosPitch = Math.cos(pitch);
        return target
            .set(-Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch)
            .normalize();
    }

    /** What the state machine settled on this frame. */
    state(): AvatarMotion {
        return this.motion;
    }

    /** The measured speed the state machine ran on, in metres a second. */
    groundSpeed(): number {
        return this.speed;
    }

    dispose(): void {
        this.disposed = true;
        this.weapon.dispose();
        this.proxy.geometry.dispose();
        if (this.placeholder) disposeObject(this.placeholder);
        this.instance?.dispose();
        this.instance = null;
        this.group.removeFromParent();
        disposeObject(this.group);
    }

    private adopt(library: CharacterLibrary): void {
        const instance = library.create(this.teamColor);
        if (!instance) return;
        if (this.placeholder) {
            this.group.remove(this.placeholder);
            disposeObject(this.placeholder);
            this.placeholder = null;
        }
        this.group.add(instance.root);
        this.instance = instance;

        for (const material of instance.materials) {
            material.emissive.set(SCENE_COLORS.hitIndicator);
            material.emissiveIntensity = 0;
        }
        const death = instance.action("death");
        if (death) {
            death.setLoop(THREE.LoopOnce, 1);
            death.clampWhenFinished = true;
        }

        // Adopting mid-match must not start a running player from a
        // standing pose, so the state machine re-enters where it is.
        const resume = this.motion;
        this.motion = "idle";
        this.current = null;
        this.play(resume, 0.02);
    }

    private action(role: ClipRole): THREE.AnimationAction | null {
        if (!this.instance) return null;
        try {
            return this.instance.action(role);
        } catch {
            return null;
        }
    }

    /* Which gait `speed` calls for, given the one already running. The
     * thresholds to enter a faster gait sit above the ones to leave it. */
    private gaitFor(speed: number): AvatarMotion {
        if (this.motion === "run") return speed >= RUN_LEAVE ? "run" : "walk";
        if (this.motion === "walk") {
            if (speed >= RUN_ENTER) return "run";
            return speed >= WALK_LEAVE ? "walk" : "idle";
        }
        if (speed >= RUN_ENTER) return "run";
        return speed >= WALK_ENTER ? "walk" : "idle";
    }

    private play(next: AvatarMotion, fade: number = CROSSFADE_SECONDS): void {
        if (next === this.motion && this.current) return;
        this.motion = next;
        const action = this.action(roleFor(next));
        if (!action) return;
        this.current?.fadeOut(fade);
        action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
        this.current = action;
    }

    /* Feet that do not keep up with the ground read as skating, so the
     * locomotion clip runs at the rate the body is actually moving. */
    private driveStride(): void {
        if (!this.current || this.motion === "idle") return;
        const reference = this.motion === "run" ? MOVE_SPEED : WALK_REFERENCE;
        const rate = this.speed / reference;
        this.current.setEffectiveTimeScale(Math.min(1.7, Math.max(0.55, rate)));
    }

    private driveSpawnPop(dt: number): void {
        if (this.spawnedFor >= SPAWN_POP_SECONDS) return;
        this.spawnedFor = Math.min(SPAWN_POP_SECONDS, this.spawnedFor + dt);
        const t = this.spawnedFor / SPAWN_POP_SECONDS;
        // Overshoot slightly and settle: a body that simply appears at
        // full size is indistinguishable from a rendering glitch.
        const scale = 1 + Math.sin(t * Math.PI) * 0.12 - (1 - t) * 0.45;
        this.group.scale.setScalar(Math.max(0.05, scale));
    }

    /* A body that vanishes the instant it dies tells the room nothing.
     * It falls, it lies there long enough to be seen, then it sinks. */
    private driveCorpse(): void {
        const sinking = this.deadFor - CORPSE_HOLD_SECONDS;
        if (sinking <= 0) {
            this.group.position.y = this.feetY;
            return;
        }
        const t = Math.min(1, sinking / CORPSE_SINK_SECONDS);
        this.group.position.y = this.feetY - t * CORPSE_SINK_METRES;
        if (t >= 1) this.group.visible = false;
    }

    /* A body that takes a hit says so, briefly and over its own colour.
     * Driven to full it reads as a light going on inside the character
     * rather than as damage, so the peak stops short of that. */
    private driveFlash(dt: number): void {
        if (this.flash <= 0 || !this.instance) return;
        this.flash = Math.max(0, this.flash - dt / DAMAGE_FLASH_SECONDS);
        const strength = this.flash * this.flash * DAMAGE_FLASH_PEAK;
        for (const material of this.instance.materials) {
            material.emissiveIntensity = strength;
        }
    }

    private setAlive(alive: boolean): void {
        this.alive = alive;
        if (alive) {
            this.deadFor = 0;
            this.spawnedFor = 0;
            this.group.visible = true;
            this.speed = 0;
            this.play("idle", 0.05);
            this.action("death")?.stop();
        } else {
            this.deadFor = 0;
            this.flash = 0;
            this.group.scale.setScalar(1);
            this.motion = "dead";
            this.current?.fadeOut(0.12);
            const death = this.action("death");
            if (death) {
                death.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.12).play();
                this.current = death;
            }
        }
        // Only a living body stops a shot. A corpse leaves the layer the
        // shot ray tests rather than leaving the scene graph.
        if (alive) this.proxy.layers.set(SHOT_LAYER);
        else this.proxy.layers.disableAll();
        this.weapon.root.visible = alive;
    }
}

function roleFor(motion: AvatarMotion): ClipRole {
    if (motion === "run") return "run";
    if (motion === "walk") return "walk";
    if (motion === "dead") return "death";
    return "idle";
}

/* What stands in until the character model arrives, and what stands in
 * for good if it never does. It is a silhouette, not a second character:
 * it has no joints and it is never animated, because a body the game
 * cannot animate should look like a marker rather than pretend. */
function buildSilhouette(color: THREE.Color, height: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "silhouette";
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(PLAYER_RADIUS, height - PLAYER_RADIUS * 2, 6, 12),
        material,
    );
    body.position.y = height / 2;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), material);
    head.position.y = height - 0.24;
    head.castShadow = true;
    group.add(body, head);
    return group;
}
