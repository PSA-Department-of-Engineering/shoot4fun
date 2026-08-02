/* The Shoot4Fun scene.
 *
 * A framework-agnostic module behind one boundary: it owns the renderer,
 * the camera rig, the arena, the player avatars and the frame loop, and
 * it exposes state to the host page through callbacks rather than
 * sharing Three.js objects outward.
 *
 * The frame loop is where the game's feel is decided, so the ordering
 * inside it is deliberate:
 *
 *  1. Read the input state and apply look to the camera immediately.
 *     Aim never waits for the network (ADR-0002). Recoil and shake are
 *     added on top as offsets, so they move the view without ever
 *     overwriting where the player pointed it.
 *  2. Predict the local player's motion with the same routine the
 *     server runs, and send that exact frame as intent (ADR-0004).
 *  3. Place every other player from the interpolation buffer, which
 *     renders them slightly in the past so 20Hz reads as smooth, and
 *     let each avatar derive its own animation from how far it moved.
 *  4. Advance effects and draw, the arena first and the holder's own
 *     weapon second, over a depth buffer of its own.
 *
 * Shots are not read from a fire button. The server spends a round on
 * every shot it allows and every snapshot carries every player's
 * magazine, so `ShotStream` reads the room's gunfire out of the world
 * itself: one authority, every player, hits and misses alike.
 *
 * The local player's own avatar is never drawn: the camera is inside it
 * (ADR-0002). What the holder sees instead is the weapon they carry,
 * which lives in `FirstPerson`.
 */

import * as THREE from "three";

import { AudioEngine } from "../audio/AudioEngine";
import { SCENE_COLORS } from "../brand/tokens";
import { InputController } from "../input/InputController";
import type { MatchClient } from "../net/MatchClient";
import type { ArenaWire, PlayerWire, RoomSnapshot } from "../net/protocol";
import { Predictor } from "../sim/Predictor";
import { SnapshotBuffer } from "../sim/SnapshotBuffer";
import { MAX_FRAME_DT, clampPitch, type ArenaLike } from "../sim/movement";
import { Avatar } from "./Avatar";
import { CharacterLibrary } from "./CharacterLibrary";
import { disposeChildren, disposeObject } from "./dispose";
import { Effects } from "./Effects";
import { FirstPerson } from "./FirstPerson";
import { SHOT_LAYER, ShotRay } from "./ShotRay";
import { ShotStream, type Shot } from "./ShotStream";
import { createGroundTexture } from "./textures";
import { ViewKick } from "./ViewKick";

const EYE_HEIGHT = 1.6;
const PLAYER_HEIGHT = 1.8;
const PING_INTERVAL_MS = 2000;

/* Longest render frame that can still be simulated in full, expressed as
 * a count of simulation slices. The server grants at most 0.25s of banked
 * simulation time, so anything past five slices is time it would refuse
 * anyway; the rest is headroom for a machine that stalled outright. */
const MAX_INPUT_SUBSTEPS = 8;
const FOOTSTEP_INTERVAL_MS = 380;
/** Metres of arena to one tile of the floor grid. */
const GROUND_TILE_METRES = 4;
/** Beyond this many metres another player's rifle is not worth hearing. */
const SHOT_EARSHOT_METRES = 55;
/** How fast the measured local speed catches up, per second. */
const SPEED_TRACKING = 16;
/** Ground covered between two frames that no stride explains. */
const TELEPORT_METRES = 2;
const MATCH_START_HORN = [392, 523, 659];
const MATCH_END_STING = [659, 523, 392];

export interface SceneApp {
    mount(container: HTMLElement): void;
    start(): void;
    stop(): void;
    dispose(): void;
    bindMatch(client: MatchClient): void;
    onState(cb: (room: RoomSnapshot) => void): () => void;
    onLocalPlayer(cb: (player: PlayerWire) => void): () => void;
    /** Ask for pointer lock. Must run inside a user gesture. */
    requestLock(): Promise<boolean>;
    isLocked(): boolean;
    onLockedChange(cb: (locked: boolean) => void): () => void;
    /** Fired when a shot of ours lands, for the hit marker. */
    onHitConfirmed(cb: (headshot: boolean, killed: boolean) => void): () => void;
    /** Fired when a shot lands on us. `direction` is the bearing of the
     * attacker in radians, zero straight ahead and positive to the
     * right, which is what a directional damage indicator needs.
     * `severity` is the damage as a fraction of full health. */
    onDamaged(cb: (direction: number, severity: number) => void): () => void;
}

export function createSceneApp(): SceneApp {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_COLORS.arenaSky);
    scene.fog = new THREE.Fog(new THREE.Color(SCENE_COLORS.arenaSky), 45, 130);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 250);
    camera.rotation.order = "YXZ";
    const rig = new THREE.Group();
    rig.name = "camera-rig";
    rig.add(camera);
    scene.add(rig);

    /* The sun alone leaves every face turned away from it black, which
     * flattens cover into a silhouette and hides the edge a player is
     * about to walk into. The sky fills those faces back in. */
    scene.add(
        new THREE.HemisphereLight(
            new THREE.Color(SCENE_COLORS.arenaSky),
            new THREE.Color(SCENE_COLORS.arenaGround),
            1.05,
        ),
    );
    const sun = new THREE.DirectionalLight(new THREE.Color(SCENE_COLORS.bg), 1.0);
    sun.position.set(18, 26, 12);
    sun.castShadow = true;
    // 1024 is the shadow budget for an arena this size: the map is lit by
    // one directional light over 90m, and doubling the texture quadruples
    // the fill cost for a difference no player reads at 1.6m eye height.
    // It also keeps the game rendering at a playable rate without a GPU,
    // which is what a browser game running on software rasterization gets.
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const groundTexture = createGroundTexture();
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({
            map: groundTexture,
            color: SCENE_COLORS.arenaGround,
            roughness: 0.95,
            metalness: 0.02,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground";
    ground.layers.enable(SHOT_LAYER);
    scene.add(ground);

    const coverGroup = new THREE.Group();
    coverGroup.name = "cover";
    const playersGroup = new THREE.Group();
    playersGroup.name = "players";
    scene.add(coverGroup, playersGroup);

    const characters = new CharacterLibrary(PLAYER_HEIGHT);
    const effects = new Effects(scene, camera);
    const viewKick = new ViewKick();
    const firstPerson = new FirstPerson(viewKick.motionReduced);
    const shotRay = new ShotRay();
    const shots = new ShotStream();
    const audio = new AudioEngine();
    const input = new InputController();
    const predictor = new Predictor();
    const buffer = new SnapshotBuffer();

    /** What a shot may touch: the arena, and the bodies standing in it. */
    const shotTargets: THREE.Object3D[] = [ground, coverGroup, playersGroup];

    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let host: HTMLElement | null = null;
    let client: MatchClient | null = null;
    let localPlayerId = "";
    let room: RoomSnapshot | null = null;
    let arena: ArenaLike | null = null;
    let arenaId = "";
    let localAlive = true;
    let localReloading = false;
    let localMaxHp = 0;
    let matchState: RoomSnapshot["state"] | null = null;
    /** The arena's own diagonal: how far a shot that hits nothing runs. */
    let shotRange = 0;

    let inputSeq = 0;
    let lastTick = 0;
    let lastPingAt = 0;
    let lastFootstepAt = 0;
    let framesRendered = 0;
    /* Lowest health the server has ever reported for this client. A
     * poll can miss a hit entirely: damage lands and the respawn puts
     * health back to full three seconds later, so any sampler slower
     * than that reads an untouched player. The client sees every
     * snapshot, so it records the floor itself. */
    let minHealthSeen = Number.POSITIVE_INFINITY;
    let lookYaw = 0;
    let lookPitch = 0;
    let lastLookYaw = 0;
    let lastLookPitch = 0;
    let localSpeed = 0;
    const clock = new THREE.Clock();

    const stateHandlers = new Set<(r: RoomSnapshot) => void>();
    const localHandlers = new Set<(p: PlayerWire) => void>();
    const hitHandlers = new Set<(headshot: boolean, killed: boolean) => void>();
    const damageHandlers = new Set<(direction: number, severity: number) => void>();
    const remotes = new Map<string, Avatar>();
    /** The roster as of the last snapshot, so the frame loop never has
     * to rebuild it out of an array it was handed. */
    const roster = new Map<string, PlayerWire>();
    const shotEvents: Shot[] = [];

    /* Scratch vectors, reused. Allocating in the frame loop is what
     * turns a smooth game into a stuttering one every few seconds. */
    const scratchMuzzle = new THREE.Vector3();
    const scratchForward = new THREE.Vector3();
    const scratchEye = new THREE.Vector3();
    const scratchImpact = new THREE.Vector3();
    const scratchQuaternion = new THREE.Quaternion();
    /** Where the player stood last frame, for measuring their speed. */
    const lastLocalPosition = new THREE.Vector3();

    function rebuildArena(next: ArenaWire): void {
        arena = next;
        arenaId = next.id;
        const width = next.bounds_max.x - next.bounds_min.x;
        const depth = next.bounds_max.z - next.bounds_min.z;
        shotRange = Math.hypot(width, depth);
        ground.scale.set(width, depth, 1);
        ground.position.set(
            (next.bounds_min.x + next.bounds_max.x) / 2,
            0,
            (next.bounds_min.z + next.bounds_max.z) / 2,
        );
        groundTexture.repeat.set(
            width / GROUND_TILE_METRES,
            depth / GROUND_TILE_METRES,
        );

        disposeChildren(coverGroup);
        for (const box of next.cover) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(box.half_x * 2, box.half_y * 2, box.half_z * 2),
                new THREE.MeshStandardMaterial({
                    color: SCENE_COLORS.arenaCover,
                    roughness: 0.8,
                }),
            );
            mesh.position.set(box.center.x, box.center.y, box.center.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.layers.enable(SHOT_LAYER);
            coverGroup.add(mesh);
        }
        buildWalls(next);
    }

    /* The arena bounds stop movement, so without something standing on
     * them the player walks to an invisible edge and looks out at void. */
    function buildWalls(next: ArenaWire): void {
        const height = 6;
        const thickness = 1;
        const minX = next.bounds_min.x;
        const maxX = next.bounds_max.x;
        const minZ = next.bounds_min.z;
        const maxZ = next.bounds_max.z;
        const width = maxX - minX;
        const depth = maxZ - minZ;
        const material = new THREE.MeshStandardMaterial({
            color: SCENE_COLORS.arenaWall,
            roughness: 0.9,
        });
        const spans: [number, number, number, number, number, number][] = [
            [(minX + maxX) / 2, height / 2, minZ - thickness / 2, width + thickness * 2, height, thickness],
            [(minX + maxX) / 2, height / 2, maxZ + thickness / 2, width + thickness * 2, height, thickness],
            [minX - thickness / 2, height / 2, (minZ + maxZ) / 2, thickness, height, depth],
            [maxX + thickness / 2, height / 2, (minZ + maxZ) / 2, thickness, height, depth],
        ];
        for (const [x, y, z, w, h, d] of spans) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.layers.enable(SHOT_LAYER);
            coverGroup.add(wall);
        }
    }

    function syncRemotes(now: number): void {
        for (const sampled of buffer.sample(now, localPlayerId)) {
            const player = roster.get(sampled.id);
            if (!player) continue;
            let avatar = remotes.get(sampled.id);
            if (!avatar) {
                avatar = new Avatar(playersGroup, characters, player.team, PLAYER_HEIGHT);
                remotes.set(sampled.id, avatar);
            }
            avatar.setPose(
                sampled.x,
                sampled.y,
                sampled.z,
                sampled.yaw,
                sampled.pitch,
                sampled.isAlive,
            );
        }

        for (const [id, avatar] of remotes) {
            if (roster.has(id) && id !== localPlayerId) continue;
            avatar.dispose();
            remotes.delete(id);
        }
    }

    function frame(): void {
        const dt = Math.min(MAX_FRAME_DT * MAX_INPUT_SUBSTEPS, clock.getDelta());
        const now = performance.now();
        const sample = input.sample();

        // 1. Look is local and instant; the kick rides on top of it.
        lookYaw = sample.yaw;
        lookPitch = clampPitch(sample.pitch);
        viewKick.update(dt);
        camera.rotation.y = lookYaw + viewKick.yawOffset();
        camera.rotation.x = clampPitch(lookPitch + viewKick.pitchOffset());
        camera.rotation.z = viewKick.rollOffset();
        camera.position.set(viewKick.shakeX(), viewKick.shakeY(), 0);

        // 2. Predict and send, in slices no longer than the simulation
        //    will honour.
        //
        //    `movement.step` clamps any frame it is given to MAX_FRAME_DT
        //    so that a forged duration buys no distance, and the client
        //    runs the same routine. A render frame longer than that ceiling
        //    sent whole would therefore travel the ceiling's worth of
        //    ground and no more, which quietly makes walking speed a
        //    function of frame rate: a machine at 10fps walks at half
        //    pace, and one on software rendering barely moves.
        //
        //    Slicing a long frame into several honest short ones fixes
        //    that without weakening anything, because the guard that
        //    actually bounds a cheat is the server's real-time budget,
        //    not this ceiling. Slices let an honest slow client keep up;
        //    they let no client get ahead.
        const playing = room?.state === "playing";
        if (playing && arena && client && localPlayerId) {
            let unsent = dt;
            do {
                const slice = Math.min(unsent, MAX_FRAME_DT);
                unsent -= slice;
                inputSeq += 1;
                const intent = {
                    dt: slice,
                    yaw: sample.yaw,
                    forward: sample.forward,
                    back: sample.back,
                    left: sample.left,
                    right: sample.right,
                };
                if (localAlive) predictor.predict(inputSeq, intent, arena);
                client.sendInput({
                    seq: inputSeq,
                    dt: slice,
                    ack_tick: lastTick,
                    buttons: {
                        forward: sample.forward,
                        back: sample.back,
                        left: sample.left,
                        right: sample.right,
                        fire: sample.fire && localAlive,
                    },
                    yaw: sample.yaw,
                    pitch: lookPitch,
                });
                // At least one frame always goes, even at dt 0: it carries
                // the look angles and the trigger, which move no distance
                // but still have to reach the server.
            } while (unsent > 0);

            const weapon = input.takeWeaponSwitch();
            if (weapon) client.switchWeapon(weapon);
            if (input.takeReload()) client.reload();

            if (
                localAlive &&
                (sample.forward || sample.back || sample.left || sample.right) &&
                now - lastFootstepAt > FOOTSTEP_INTERVAL_MS
            ) {
                audio.footstep();
                lastFootstepAt = now;
            }
            if (now - lastPingAt > PING_INTERVAL_MS) {
                client.ping();
                lastPingAt = now;
            }
        }

        // The rig carries locomotion; the camera only ever rotates.
        const position = predictor.current();
        trackLocalSpeed(position.x, position.z, dt);
        rig.position.set(position.x, position.y + EYE_HEIGHT, position.z);

        // 3. Everyone else, rendered slightly in the past. Each avatar
        //    reads its own locomotion out of how far it just moved.
        syncRemotes(now);
        for (const avatar of remotes.values()) avatar.update(dt);

        // 4. Effects, the weapon in hand, and the draw. The motion
        //    preference lives on the kick, which watches it, so the
        //    weapon reads it from there rather than watching it twice.
        firstPerson.setMotionReduced(viewKick.motionReduced);
        firstPerson.update(
            dt,
            localSpeed,
            localReloading,
            localAlive,
            lookYaw - lastLookYaw,
            lookPitch - lastLookPitch,
        );
        lastLookYaw = lookYaw;
        lastLookPitch = lookPitch;
        effects.update(dt);

        if (renderer) {
            renderer.clear();
            renderer.render(scene, camera);
            framesRendered += 1;
            firstPerson.render(renderer);
        }
        if (host && host.dataset.sceneReady !== "true") {
            host.dataset.sceneReady = "true";
        }
    }

    /* The weapon bobs at the rate the player is actually moving, and
     * the predictor reports a position rather than a velocity, so the
     * speed is measured the same way an avatar's is. */
    function trackLocalSpeed(x: number, z: number, dt: number): void {
        if (dt <= 0) return;
        const travelled = Math.hypot(x - lastLocalPosition.x, z - lastLocalPosition.z);
        lastLocalPosition.set(x, 0, z);
        const measured = travelled > TELEPORT_METRES ? 0 : travelled / dt;
        localSpeed += (measured - localSpeed) * Math.min(1, SPEED_TRACKING * dt);
    }

    /* One round, fired by the player holding this browser. The flash
     * card is drawn in their own view; the arena gets the light, the
     * tracer and whatever the round lands on. */
    function fireLocal(): void {
        if (shotRange <= 0) return;
        firstPerson.fire();
        viewKick.recoil();
        audio.shot();

        camera.getWorldQuaternion(scratchQuaternion);
        scratchForward.set(0, 0, -1).applyQuaternion(scratchQuaternion).normalize();
        scratchEye.copy(rig.position);
        firstPerson.muzzleWorld(scratchMuzzle, camera);
        markShot(scratchMuzzle, scratchEye, scratchForward);
        effects.holderMuzzle(scratchMuzzle, scratchForward);
    }

    /* One round, fired by somebody else. Their aim is interpolated like
     * the rest of them, so the ray is drawn from where they are seen to
     * be looking rather than from where the server resolved it. */
    function fireRemote(playerId: string): void {
        const avatar = remotes.get(playerId);
        if (!avatar || shotRange <= 0) return;
        avatar.fire();
        avatar.muzzlePoint(scratchMuzzle);
        avatar.eyePoint(scratchEye, EYE_HEIGHT);
        avatar.lookDirection(scratchForward);
        markShot(scratchMuzzle, scratchEye, scratchForward);
        effects.muzzleFlash(scratchMuzzle, scratchForward);
        audio.shot(earshot(scratchMuzzle));
    }

    /** Draw the flight of one round: a streak from the gun to wherever
     * the ray ends, and a mark on the world if that is what stopped it. */
    function markShot(
        from: THREE.Vector3,
        eye: THREE.Vector3,
        direction: THREE.Vector3,
    ): void {
        const hit = shotRay.cast(eye, direction, shotRange, shotTargets);
        if (hit) scratchImpact.copy(hit.point);
        else scratchImpact.copy(eye).addScaledVector(direction, shotRange);
        effects.tracer(from, scratchImpact);
        // A body is marked by the server's own `damage` message, which
        // carries the point it actually landed on.
        if (hit && !hit.body) effects.impact(hit.point, hit.normal);
    }

    /** How loud something at `at` is from where the player is standing. */
    function earshot(at: THREE.Vector3): number {
        const distance = at.distanceTo(rig.position);
        return Math.max(0, 1 - distance / SHOT_EARSHOT_METRES);
    }

    /** The bearing of `playerId` relative to where the player is facing,
     * zero straight ahead and positive to the right. */
    function bearingTo(playerId: string): number {
        const attacker = remotes.get(playerId);
        if (!attacker) return 0;
        const dx = attacker.group.position.x - rig.position.x;
        const dz = attacker.group.position.z - rig.position.z;
        // Forward is (-sin yaw, -cos yaw) and right is (cos yaw, -sin yaw),
        // the convention `movement` walks and strafes by.
        const ahead = -Math.sin(lookYaw) * dx - Math.cos(lookYaw) * dz;
        const beside = Math.cos(lookYaw) * dx - Math.sin(lookYaw) * dz;
        return Math.atan2(beside, ahead);
    }

    function takeDamage(attackerId: string, damage: number): void {
        const severity = localMaxHp > 0 ? Math.min(1, damage / localMaxHp) : 0.5;
        firstPerson.damaged(0.45 + severity * 0.55);
        viewKick.jolt(0.3 + severity * 0.7);
        audio.hurt();
        const direction = bearingTo(attackerId);
        for (const handler of damageHandlers) handler(direction, severity);
    }

    function readShots(players: PlayerWire[]): void {
        shots.read(players, shotEvents);
        for (const shot of shotEvents) {
            for (let round = 0; round < shot.count; round++) {
                if (shot.playerId === localPlayerId) fireLocal();
                else fireRemote(shot.playerId);
            }
        }
    }

    /* A read-only window onto live scene state, for e2e specs.
     *
     * Every accessor here reads an actual object the renderer is using
     * this frame: the camera's real rotation, the predictor's real
     * position, the real lock state, the animation each avatar's own
     * state machine settled on. None of it is a constant the production
     * code carries for a test's benefit, which is the line this surface
     * must not cross. A spec asserting on a hardcoded literal exported
     * from here would attest nothing.
     */
    function exposeDebugSurface(): void {
        (window as unknown as { __sfDebug: unknown }).__sfDebug = {
            camera: () => ({ yaw: camera.rotation.y, pitch: camera.rotation.x }),
            position: () => ({ ...predictor.current() }),
            correction: () => predictor.correction(),
            pendingInputs: () => predictor.pendingCount(),
            locked: () => input.isLocked(),
            remoteCount: () => remotes.size,
            remotes: () =>
                [...remotes.entries()].map(([id, avatar]) => ({
                    id,
                    x: avatar.group.position.x,
                    y: avatar.group.position.y,
                    z: avatar.group.position.z,
                    visible: avatar.group.visible,
                    animation: avatar.state(),
                    speed: avatar.groundSpeed(),
                })),
            coverCount: () => coverGroup.children.length,
            /* The arena the meshes were built from, which is not the same
             * fact as the arena the last snapshot named: this one is only
             * true once the scene has actually been rebuilt. */
            sceneArenaId: () => arenaId,
            /* The bounds the server sent, so a harness can read the map it
             * was actually given rather than carry a copy of one. */
            bounds: () =>
                room
                    ? { min: room.arena.bounds_min, max: room.arena.bounds_max }
                    : null,
            state: () => room?.state ?? null,
            localId: () => localPlayerId,
            /* This client's own hit points, as the server last sent them.
             * The HUD renders the same number, but reading it from the DOM
             * makes an assertion about damage depend on the victim's page
             * getting a frame to repaint in, which on software rendering
             * it may not. The value is still server-authored and still
             * read on the victim's own client. */
            health: () => room?.players.find((p) => p.id === localPlayerId)?.hp ?? null,
            framesRendered: () => framesRendered,
            ammo: () =>
                room?.players.find((p) => p.id === localPlayerId)?.ammo ?? null,
            minHealth: () =>
                Number.isFinite(minHealthSeen) ? minHealthSeen : null,
            characterLoaded: () => characters.loaded,
            tracerCount: () => effects.tracerCount(),
            decalCount: () => effects.decalCount(),
            particleCount: () => effects.particles.liveCount(),
            viewKick: () => viewKick.intensity(),
            motionReduced: () => viewKick.motionReduced,
        };
    }

    function adoptSnapshot(next: RoomSnapshot): void {
        if (arenaId !== next.arena.id) rebuildArena(next.arena);
        room = next;
        lastTick = next.tick;
        buffer.push(next.players, performance.now());

        roster.clear();
        for (const player of next.players) roster.set(player.id, player);

        if (matchState !== next.state) {
            if (matchState !== null && next.state === "playing") {
                audio.sting(MATCH_START_HORN);
            } else if (next.state === "results") {
                audio.sting(MATCH_END_STING);
            }
            matchState = next.state;
        }

        const me = next.players.find((p) => p.id === localPlayerId);
        if (me && arena) {
            const wasAlive = localAlive;
            localAlive = me.is_alive;
            localReloading = me.is_reloading;
            localMaxHp = me.max_hp;
            if (!wasAlive && me.is_alive) {
                // Respawned somewhere the client never predicted, so
                // adopt the server outright rather than correcting to it.
                predictor.reset(me.position);
                input.setLook(me.yaw, me.pitch);
            } else if (me.is_alive) {
                predictor.reconcile(me.position, me.last_input_seq, arena);
            } else {
                predictor.reset(me.position);
            }
            minHealthSeen = Math.min(minHealthSeen, me.hp);
            for (const handler of localHandlers) handler(me);
        }

        // The world first, then what it looked like. A snapshot's job is
        // to tell the HUD and the menus what is true; the flashes and
        // tracers it also implies are downstream of that and must never
        // be able to stand in front of it.
        for (const handler of stateHandlers) handler(next);
        readShots(next.players);
    }

    function bindMatch(next: MatchClient): void {
        client = next;
        next.on((msg) => {
            switch (msg.type) {
                case "hello":
                    localPlayerId = msg.player_id;
                    if (msg.room) adoptSnapshot(msg.room);
                    break;
                case "lobby_state":
                case "match_started":
                case "state":
                case "results":
                    if (msg.type === "match_started") {
                        buffer.clear();
                        shots.clear();
                        inputSeq = 0;
                    }
                    adoptSnapshot(msg.room);
                    break;
                case "player_left":
                    if (room) {
                        adoptSnapshot({
                            ...room,
                            players: room.players.filter(
                                (p) => p.id !== msg.player_id,
                            ),
                        });
                    }
                    break;
                case "hit_confirmed":
                    audio.hit();
                    for (const handler of hitHandlers) {
                        handler(msg.headshot, msg.killed);
                    }
                    break;
                case "damage": {
                    if (msg.point) {
                        scratchImpact.set(msg.point.x, msg.point.y, msg.point.z);
                        effects.bodyImpact(scratchImpact);
                    }
                    remotes.get(msg.victim)?.takeDamage();
                    if (msg.victim === localPlayerId) {
                        takeDamage(msg.attacker, msg.damage);
                    }
                    break;
                }
                default:
                    break;
            }
        });
    }

    return {
        mount(container) {
            host = container;
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            // The weapon in hand is drawn in a second pass, so clearing
            // is this module's to schedule rather than the renderer's.
            renderer.autoClear = false;
            container.appendChild(renderer.domElement);

            observer = new ResizeObserver(() => {
                if (!renderer || !host) return;
                const width = Math.max(host.clientWidth, 1);
                const height = Math.max(host.clientHeight, 1);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                firstPerson.resize(width / height);
                renderer.setSize(width, height, false);
            });
            observer.observe(container);

            input.attach(renderer.domElement);
            audio.ensure();
            // Start fetching the character now rather than when the
            // first opponent walks in, or they arrive as a silhouette
            // and turn into a body a second later.
            void characters.ready();
            exposeDebugSurface();
        },
        start() {
            clock.start();
            renderer?.setAnimationLoop(frame);
        },
        stop() {
            renderer?.setAnimationLoop(null);
        },
        dispose() {
            this.stop();
            observer?.disconnect();
            observer = null;
            input.dispose();
            viewKick.dispose();
            for (const avatar of remotes.values()) avatar.dispose();
            remotes.clear();
            roster.clear();
            effects.dispose();
            firstPerson.dispose();
            characters.dispose();
            groundTexture.dispose();
            stateHandlers.clear();
            localHandlers.clear();
            hitHandlers.clear();
            damageHandlers.clear();
            disposeObject(scene);
            renderer?.dispose();
            renderer?.domElement.remove();
            renderer = null;
            host = null;
        },
        bindMatch,
        onState(cb) {
            stateHandlers.add(cb);
            return () => stateHandlers.delete(cb);
        },
        onLocalPlayer(cb) {
            localHandlers.add(cb);
            return () => localHandlers.delete(cb);
        },
        onHitConfirmed(cb) {
            hitHandlers.add(cb);
            return () => hitHandlers.delete(cb);
        },
        onDamaged(cb) {
            damageHandlers.add(cb);
            return () => damageHandlers.delete(cb);
        },
        requestLock() {
            // A gesture is the only moment a browser will start audio,
            // and it is the same gesture that takes the mouse.
            audio.resume();
            audio.setStarted(true);
            return input.requestLock();
        },
        isLocked() {
            return input.isLocked();
        },
        onLockedChange(cb) {
            return input.onLockedChange(cb);
        },
    };
}
