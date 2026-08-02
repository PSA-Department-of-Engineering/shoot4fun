/* The Shoot4Fun scene.
 *
 * A framework-agnostic module behind one boundary: it owns the renderer,
 * the camera rig, the arena, the player meshes and the frame loop, and
 * it exposes state to the host page through callbacks rather than
 * sharing Three.js objects outward.
 *
 * The frame loop is where the game's feel is decided, so the ordering
 * inside it is deliberate:
 *
 *  1. Read the input state and apply look to the camera immediately.
 *     Aim never waits for the network (ADR-0002).
 *  2. Predict the local player's motion with the same routine the
 *     server runs, and send that exact frame as intent (ADR-0004).
 *  3. Place every other player from the interpolation buffer, which
 *     renders them slightly in the past so 20Hz reads as smooth.
 *  4. Advance effects and draw.
 *
 * The local player's own avatar is never drawn: the camera is inside it
 * (ADR-0002).
 */

import * as THREE from "three";

import { AudioEngine } from "../audio/AudioEngine";
import { SCENE_COLORS } from "../brand/tokens";
import { InputController } from "../input/InputController";
import type { MatchClient } from "../net/MatchClient";
import type { ArenaWire, PlayerWire, RoomSnapshot } from "../net/protocol";
import { Predictor } from "../sim/Predictor";
import { SnapshotBuffer } from "../sim/SnapshotBuffer";
import { clampPitch, type ArenaLike } from "../sim/movement";
import { ParticleSystem } from "./Particles";

const EYE_HEIGHT = 1.6;
const PLAYER_HEIGHT = 1.8;
const PING_INTERVAL_MS = 2000;
const FOOTSTEP_INTERVAL_MS = 380;

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
}

interface RemoteMesh {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Mesh;
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

    scene.add(
        new THREE.HemisphereLight(
            new THREE.Color(SCENE_COLORS.arenaSky),
            new THREE.Color(SCENE_COLORS.arenaGround),
            0.65,
        ),
    );
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.0);
    sun.position.set(18, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({
            color: SCENE_COLORS.arenaGround,
            roughness: 0.95,
            metalness: 0.02,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground";
    scene.add(ground);

    const coverGroup = new THREE.Group();
    coverGroup.name = "cover";
    const playersGroup = new THREE.Group();
    playersGroup.name = "players";
    scene.add(coverGroup, playersGroup);

    const particles = new ParticleSystem(scene);
    const audio = new AudioEngine();
    const input = new InputController();
    const predictor = new Predictor();
    const buffer = new SnapshotBuffer();

    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let host: HTMLElement | null = null;
    let client: MatchClient | null = null;
    let localPlayerId = "";
    let room: RoomSnapshot | null = null;
    let arena: ArenaLike | null = null;
    let arenaId = "";
    let localAlive = true;

    let inputSeq = 0;
    let lastTick = 0;
    let lastPingAt = 0;
    let lastFootstepAt = 0;
    const clock = new THREE.Clock();

    const stateHandlers = new Set<(r: RoomSnapshot) => void>();
    const localHandlers = new Set<(p: PlayerWire) => void>();
    const hitHandlers = new Set<(headshot: boolean, killed: boolean) => void>();
    const remotes = new Map<string, RemoteMesh>();

    /* Scratch vectors, reused. Allocating in the frame loop is what
     * turns a smooth game into a stuttering one every few seconds. */
    const scratchMuzzle = new THREE.Vector3();
    const scratchForward = new THREE.Vector3();

    function rebuildArena(next: ArenaWire): void {
        arena = next;
        arenaId = next.id;
        const width = next.bounds_max.x - next.bounds_min.x;
        const depth = next.bounds_max.z - next.bounds_min.z;
        ground.scale.set(width, depth, 1);
        ground.position.set(
            (next.bounds_min.x + next.bounds_max.x) / 2,
            0,
            (next.bounds_min.z + next.bounds_max.z) / 2,
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
            coverGroup.add(wall);
        }
    }

    function makeRemote(player: PlayerWire): RemoteMesh {
        const colour = new THREE.Color(
            player.team === 2 ? SCENE_COLORS.team2 : SCENE_COLORS.team1,
        );
        const group = new THREE.Group();
        group.name = `player-${player.id}`;
        const material = new THREE.MeshStandardMaterial({
            color: colour,
            roughness: 0.55,
        });
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.45, PLAYER_HEIGHT - 0.9, 6, 12),
            material,
        );
        body.position.y = PLAYER_HEIGHT / 2;
        body.castShadow = true;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 16, 16),
            material.clone(),
        );
        head.position.y = EYE_HEIGHT;
        head.castShadow = true;
        group.add(body, head);
        playersGroup.add(group);
        return { group, body, head };
    }

    function syncRemotes(now: number): void {
        if (!room) return;
        const known = new Map(room.players.map((p) => [p.id, p]));

        for (const sampled of buffer.sample(now, localPlayerId)) {
            const player = known.get(sampled.id);
            if (!player) continue;
            let mesh = remotes.get(sampled.id);
            if (!mesh) {
                mesh = makeRemote(player);
                remotes.set(sampled.id, mesh);
            }
            mesh.group.position.set(sampled.x, sampled.y, sampled.z);
            mesh.group.rotation.y = sampled.yaw;
            mesh.group.visible = sampled.isAlive;
        }

        for (const [id, mesh] of remotes) {
            if (known.has(id) && id !== localPlayerId) continue;
            playersGroup.remove(mesh.group);
            disposeObject(mesh.group);
            remotes.delete(id);
        }
    }

    function frame(): void {
        const dt = Math.min(0.1, clock.getDelta());
        const now = performance.now();
        const sample = input.sample();

        // 1. Look is local and instant.
        camera.rotation.y = sample.yaw;
        camera.rotation.x = clampPitch(sample.pitch);

        // 2. Predict and send.
        const playing = room?.state === "playing";
        if (playing && arena && client && localPlayerId) {
            inputSeq += 1;
            const intent = {
                dt,
                yaw: sample.yaw,
                forward: sample.forward,
                back: sample.back,
                left: sample.left,
                right: sample.right,
            };
            if (localAlive) predictor.predict(inputSeq, intent, arena);
            client.sendInput({
                seq: inputSeq,
                dt,
                ack_tick: lastTick,
                buttons: {
                    forward: sample.forward,
                    back: sample.back,
                    left: sample.left,
                    right: sample.right,
                    fire: sample.fire && localAlive,
                },
                yaw: sample.yaw,
                pitch: clampPitch(sample.pitch),
            });

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
        rig.position.set(position.x, position.y + EYE_HEIGHT, position.z);

        // 3. Everyone else, rendered slightly in the past.
        syncRemotes(now);

        // 4. Effects and draw.
        particles.update(dt);
        if (renderer) renderer.render(scene, camera);
        if (host && host.dataset.sceneReady !== "true") {
            host.dataset.sceneReady = "true";
        }
    }

    function adoptSnapshot(next: RoomSnapshot): void {
        if (arenaId !== next.arena.id) rebuildArena(next.arena);
        room = next;
        lastTick = next.tick;
        buffer.push(next.players, performance.now());

        const me = next.players.find((p) => p.id === localPlayerId);
        if (me && arena) {
            const wasAlive = localAlive;
            localAlive = me.is_alive;
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
            for (const handler of localHandlers) handler(me);
        }
        for (const handler of stateHandlers) handler(next);
    }

    /* A read-only window onto live scene state, for e2e specs.
     *
     * Every accessor here reads an actual object the renderer is using
     * this frame: the camera's real rotation, the predictor's real
     * position, the real lock state. None of it is a constant the
     * production code carries for a test's benefit, which is the line
     * this surface must not cross. A spec asserting on a hardcoded
     * literal exported from here would attest nothing.
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
                [...remotes.entries()].map(([id, mesh]) => ({
                    id,
                    x: mesh.group.position.x,
                    y: mesh.group.position.y,
                    z: mesh.group.position.z,
                    visible: mesh.group.visible,
                })),
            coverCount: () => coverGroup.children.length,
            state: () => room?.state ?? null,
            localId: () => localPlayerId,
        };
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
                        particles.hit(
                            new THREE.Vector3(msg.point.x, msg.point.y, msg.point.z),
                        );
                    }
                    if (msg.attacker === localPlayerId) {
                        audio.shot();
                        scratchForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
                        scratchMuzzle
                            .copy(rig.position)
                            .addScaledVector(scratchForward, 0.8);
                        particles.muzzleFlash(scratchMuzzle, scratchForward);
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
            container.appendChild(renderer.domElement);

            observer = new ResizeObserver(() => {
                if (!renderer || !host) return;
                const width = Math.max(host.clientWidth, 1);
                const height = Math.max(host.clientHeight, 1);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
            });
            observer.observe(container);

            input.attach(renderer.domElement);
            audio.ensure();
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
            particles.dispose();
            stateHandlers.clear();
            localHandlers.clear();
            hitHandlers.clear();
            remotes.clear();
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
        requestLock() {
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

function disposeChildren(group: THREE.Group): void {
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
    }
}

function disposeObject(root: THREE.Object3D): void {
    root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) for (const m of material) m.dispose();
        else material?.dispose();
    });
}
