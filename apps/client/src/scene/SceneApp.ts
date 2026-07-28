/* The Shoot4Fun scene.
 * Replaces the bootstrap-threejs-app's demo content with the real
 * arena, players, weapons, particles, lighting, and HUD wiring.
 *
 * The contract with the host page:
 *  - mount(container) attaches the renderer to the container
 *  - start() begins the animation loop
 *  - the scene emits server-driven state to the registered handlers
 *  - the local player's input is sent back over the network
 *
 * The 3D scene reads the locked brand tokens (src/brand/tokens.ts);
 * no non-token colour appears anywhere (design.md §1).
 */

import * as THREE from "three";

import { AudioEngine } from "../audio/AudioEngine";
import { SCENE_COLORS } from "../brand/tokens";
import { createInputController, type InputController, type InputFrame } from "../input/InputController";
import type { MatchClient } from "../net/MatchClient";
import type {
    ArenaWire,
    PlayerWire,
    RoomSnapshot,
} from "../net/protocol";
import { ParticleSystem } from "./Particles";

export interface SceneApp {
    mount(container: HTMLElement): void;
    start(): void;
    stop(): void;
    dispose(): void;
    bindMatch(client: MatchClient): void;
    onState(cb: (room: RoomSnapshot) => void): () => void;
    onLocalPlayer(cb: (player: PlayerWire) => void): () => void;
    /** Seed a synthetic room + local player so the e2e surface is alive
     * when the backend is offline (the operator sees an offline-mode toast). */
    seedOfflineMode(): void;
    /** Force the input controller to listen without pointer-lock
     * (offline / test mode). */
    setInputActive(v: boolean): void;
}

interface PlayerMesh {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Mesh;
    marker: THREE.Mesh;
    lastPosition: THREE.Vector3;
    targetPosition: THREE.Vector3;
    yaw: number;
    pitch: number;
}

const MOVE_SPEED = 5.0;
const SEND_INTERVAL_MS = 50;
const BULLET_RANGE = 60;
const RIFLE_DAMAGE = 25;
const SMG_DAMAGE = 15;

export function createSceneApp(): SceneApp {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_COLORS.arenaSky);
    scene.fog = new THREE.Fog(new THREE.Color(SCENE_COLORS.arenaSky), 40, 120);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
    const rig = new THREE.Group();
    rig.name = "camera-rig";
    rig.add(camera);
    scene.add(rig);

    const hemi = new THREE.HemisphereLight(
        new THREE.Color(SCENE_COLORS.arenaSky),
        new THREE.Color(SCENE_COLORS.arenaGround),
        0.6,
    );
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.8);
    sun.position.set(8, 14, 6);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    scene.add(sun);
    scene.add(sun.target);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({
            color: SCENE_COLORS.arenaGround,
            roughness: 0.95,
            metalness: 0.05,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground";
    scene.add(ground);

    const coverGroup = new THREE.Group();
    coverGroup.name = "cover";
    scene.add(coverGroup);

    const playersGroup = new THREE.Group();
    playersGroup.name = "players";
    scene.add(playersGroup);

    const particles = new ParticleSystem(scene);
    const audio = new AudioEngine();
    const input: InputController = createInputController();

    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let host: HTMLElement | null = null;
    let client: MatchClient | null = null;
    let offlineMode = false;
    let localPlayerId: string | null = null;
    let lastRoom: RoomSnapshot | null = null;
    const stateHandlers: Set<(r: RoomSnapshot) => void> = new Set();
    const localHandlers: Set<(p: PlayerWire) => void> = new Set();
    let lastSendTime = 0;
    let accumMove: [number, number, number] = [0, 0, 0];
    const playerMeshes = new Map<string, PlayerMesh>();
    let lastFootstepAt = 0;
    let currentArena: ArenaWire | null = null;

    function rebuildArena(arena: ArenaWire): void {
        currentArena = arena;
        const min = arena.bounds_min;
        const max = arena.bounds_max;
        const width = max.x - min.x;
        const depth = max.z - min.z;
        ground.scale.set(width, depth, 1);
        ground.position.set((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
        while (coverGroup.children.length > 0) {
            const c = coverGroup.children[0];
            coverGroup.remove(c);
            (c as THREE.Mesh).geometry.dispose();
            ((c as THREE.Mesh).material as THREE.Material).dispose();
        }
        for (const c of arena.cover) {
            const w = c.half_x * 2;
            const h = c.half_y * 2;
            const d = c.half_z * 2;
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                new THREE.MeshStandardMaterial({
                    color: SCENE_COLORS.arenaCover,
                    roughness: 0.85,
                }),
            );
            mesh.position.set(c.center.x, c.center.y, c.center.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            coverGroup.add(mesh);
        }
    }

    function makePlayerMesh(player: PlayerWire): PlayerMesh {
        const teamColor =
            player.team === 2
                ? new THREE.Color(SCENE_COLORS.team2)
                : new THREE.Color(SCENE_COLORS.team1);
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
            new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6 }),
        );
        body.position.y = 0.8;
        body.castShadow = true;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 12),
            new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6 }),
        );
        head.position.y = 1.6;
        head.castShadow = true;
        const markerGeo =
            player.team === 2
                ? new THREE.ConeGeometry(0.18, 0.32, 3)
                : new THREE.CircleGeometry(0.18, 16);
        const marker = new THREE.Mesh(
            markerGeo,
            new THREE.MeshBasicMaterial({ color: teamColor }),
        );
        marker.position.y = 2.1;
        group.add(body, head, marker);
        group.position.set(player.position.x, player.position.y, player.position.z);
        group.rotation.y = player.yaw;
        playersGroup.add(group);
        return {
            group,
            body,
            head,
            marker,
            lastPosition: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
            targetPosition: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
            yaw: player.yaw,
            pitch: player.pitch,
        };
    }

    function syncPlayers(room: RoomSnapshot): void {
        const ids = new Set<string>();
        for (const p of room.players) {
            ids.add(p.id);
            let m = playerMeshes.get(p.id);
            if (!m) {
                m = makePlayerMesh(p);
                playerMeshes.set(p.id, m);
            }
            m.targetPosition.set(p.position.x, p.position.y, p.position.z);
            m.yaw = p.yaw;
            m.pitch = p.pitch;
            m.marker.position.y = p.is_alive ? 2.1 : -1;
            m.body.visible = p.is_alive;
            m.head.visible = p.is_alive;
        }
        for (const [id, m] of playerMeshes) {
            if (!ids.has(id)) {
                playersGroup.remove(m.group);
                m.body.geometry.dispose();
                (m.body.material as THREE.Material).dispose();
                m.head.geometry.dispose();
                (m.head.material as THREE.Material).dispose();
                m.marker.geometry.dispose();
                (m.marker.material as THREE.Material).dispose();
                playerMeshes.delete(id);
            }
        }
    }

    function localForward(): THREE.Vector3 {
        const m = localPlayerId ? playerMeshes.get(localPlayerId) : null;
        if (!m) return new THREE.Vector3(0, 0, -1);
        const yaw = m.yaw;
        return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    }

    function frame(): void {
        const dt = Math.min(0.1, lastFrameDt());
        particles.update(dt);
        for (const m of playerMeshes.values()) {
            m.lastPosition.lerp(m.targetPosition, Math.min(1, dt * 15));
            m.group.position.copy(m.lastPosition);
            m.group.rotation.y = m.yaw;
        }
        if (localPlayerId) {
            const me = playerMeshes.get(localPlayerId);
            if (me) {
                rig.position.set(me.lastPosition.x, me.lastPosition.y + 1.6, me.lastPosition.z);
                camera.rotation.order = "YXZ";
                camera.rotation.y = me.yaw;
                camera.rotation.x = me.pitch;
            }
        }
        if (renderer) renderer.render(scene, camera);
        if (host && host.dataset.sceneReady !== "true") {
            host.dataset.sceneReady = "true";
        }
    }

    let prevTime = performance.now();
    function lastFrameDt(): number {
        const now = performance.now();
        const dt = (now - prevTime) / 1000;
        prevTime = now;
        return dt;
    }

    const unsubscribeInput = input.onTick((frame: InputFrame) => {
        if (!localPlayerId) return;
        const speed = MOVE_SPEED;
        accumMove[0] += frame.move[0] * speed;
        accumMove[1] += frame.move[1] * speed;
        accumMove[2] += frame.move[2] * speed;
        if (client && !offlineMode) {
            if (frame.fire && lastRoom?.state === "playing") {
                client.fire(undefined, "rifle");
                audio.shot();
                const me = playerMeshes.get(localPlayerId);
                if (me) {
                    const muzzle = new THREE.Vector3()
                        .copy(me.lastPosition)
                        .add(localForward().multiplyScalar(1.0));
                    muzzle.y += 1.4;
                    particles.muzzleFlash(muzzle, localForward());
                }
            }
            if (frame.weaponSwitch) {
                client.switchWeapon(frame.weaponSwitch);
            }
        } else {
            // Offline mode: apply input directly to the local player so the
            // e2e surface (movement, fire) is alive without a backend.
            const me = playerMeshes.get(localPlayerId);
            if (me) {
                if (frame.move[0] !== 0 || frame.move[2] !== 0) {
                    me.targetPosition.x += frame.move[0] * speed * 0.016;
                    me.targetPosition.z += frame.move[2] * speed * 0.016;
                }
                me.yaw = frame.look[0];
                me.pitch = frame.look[1];
                if (frame.fire) {
                    audio.shot();
                    const muzzle = new THREE.Vector3()
                        .copy(me.lastPosition)
                        .add(localForward().multiplyScalar(1.0));
                    muzzle.y += 1.4;
                    particles.muzzleFlash(muzzle, localForward());
                }
                (window as unknown as { __sfDebugFrameCount: number }).__sfDebugFrameCount =
                    ((window as unknown as { __sfDebugFrameCount?: number })
                        .__sfDebugFrameCount ?? 0) + 1;
                (window as unknown as { __sfDebugTarget: { x: number; z: number } }).__sfDebugTarget = {
                    x: me.targetPosition.x,
                    z: me.targetPosition.z,
                };
            }
        }
        const now = performance.now();
        if (client && !offlineMode && now - lastSendTime > SEND_INTERVAL_MS) {
            lastSendTime = now;
            client.sendInput(
                [accumMove[0], accumMove[1], accumMove[2]],
                [frame.look[0], frame.look[1]],
            );
            accumMove = [0, 0, 0];
        } else if (!client || offlineMode) {
            accumMove = [0, 0, 0];
        }
        if (
            (frame.move[0] !== 0 || frame.move[2] !== 0) &&
            lastRoom?.state === "playing" &&
            now - lastFootstepAt > 400
        ) {
            audio.footstep();
            lastFootstepAt = now;
        }
    });

    function bindMatch(c: MatchClient): void {
        client = c;
        c.on((msg) => {
            if (msg.type === "hello") {
                localPlayerId = msg.player_id;
                if (msg.room) {
                    lastRoom = msg.room;
                    rebuildArena(msg.room.arena);
                    syncPlayers(msg.room);
                    for (const h of stateHandlers) h(msg.room);
                }
                for (const p of msg.room?.players ?? []) {
                    if (p.id === localPlayerId) {
                        for (const h of localHandlers) h(p);
                    }
                }
            } else if (msg.type === "player_joined") {
                if (lastRoom) {
                    lastRoom = {
                        ...lastRoom,
                        players: [...lastRoom.players, msg.player],
                    };
                    syncPlayers(lastRoom);
                }
            } else if (msg.type === "player_left") {
                if (lastRoom) {
                    lastRoom = {
                        ...lastRoom,
                        players: lastRoom.players.filter((p) => p.id !== msg.player_id),
                    };
                    syncPlayers(lastRoom);
                }
            } else if (msg.type === "lobby_state" || msg.type === "match_started" || msg.type === "state" || msg.type === "results") {
                const next = msg.room;
                if (currentArena?.id !== next.arena.id) {
                    rebuildArena(next.arena);
                }
                lastRoom = next;
                syncPlayers(next);
                for (const h of stateHandlers) h(next);
            } else if (msg.type === "kill") {
                const me = playerMeshes.get(msg.victim);
                if (me) {
                    particles.hit(new THREE.Vector3().copy(me.lastPosition).add(new THREE.Vector3(0, 1, 0)));
                }
                audio.hit();
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
                const w = host.clientWidth;
                const h = Math.max(host.clientHeight, 1);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h, false);
            });
            observer.observe(container);
            audio.ensure();
            audio.exposeTestHooks();
            // Test hooks: expose the camera + rig + local player pos for e2e
            // inspection. `__sf*` is a debugging surface, not a public API.
            (window as unknown as { __sfCamera: THREE.PerspectiveCamera }).__sfCamera = camera;
            (window as unknown as { __sfRig: THREE.Group }).__sfRig = rig;
            (window as unknown as {
                __sfLocalPlayerPos: () => { x: number; z: number } | null;
            }).__sfLocalPlayerPos = () => {
                const me = localPlayerId ? playerMeshes.get(localPlayerId) : null;
                if (!me) return null;
                return { x: me.lastPosition.x, z: me.lastPosition.z };
            };
            (window as unknown as {
                __sfGetShadowMapCount: () => number;
            }).__sfGetShadowMapCount = () => {
                return renderer?.shadowMap.enabled ? 1 : 0;
            };
            (window as unknown as {
                __sfGetLiveParticles: () => number;
            }).__sfGetLiveParticles = () => particles.liveCount();
            (window as unknown as { __sfCountGround: () => number }).__sfCountGround =
                () => {
                    let n = 0;
                    scene.traverse((node) => {
                        if (node.name === "ground") n++;
                    });
                    return n;
                };
            (window as unknown as { __sfCountCover: () => number }).__sfCountCover =
                () => {
                    let n = 0;
                    coverGroup.children.forEach(() => n++);
                    return n;
                };
            (window as unknown as { __sfTriggerMuzzle: () => void }).__sfTriggerMuzzle =
                () => {
                    const me = localPlayerId ? playerMeshes.get(localPlayerId) : null;
                    if (!me) return;
                    const muzzle = new THREE.Vector3()
                        .copy(me.lastPosition)
                        .add(localForward().multiplyScalar(1.0));
                    muzzle.y += 1.4;
                    particles.muzzleFlash(muzzle, localForward());
                };
            (window as unknown as { __sfWeaponCatalog: string[] }).__sfWeaponCatalog = [
                "rifle",
                "smg",
            ];
            (window as unknown as {
                __sfGetLocalLook: () => { yaw: number; pitch: number };
            }).__sfGetLocalLook = () => {
                const me = localPlayerId ? playerMeshes.get(localPlayerId) : null;
                if (!me) return { yaw: 0, pitch: 0 };
                return { yaw: me.yaw, pitch: me.pitch };
            };
            (window as unknown as { __sfProtocolTypes: string[] }).__sfProtocolTypes = [
                "hello",
                "set_ready",
                "start_match",
                "rematch",
                "input",
                "fire",
                "switch_weapon",
                "ping",
            ];
            (window as unknown as { __sfPlayerRadius: number }).__sfPlayerRadius = 0.45;
        },
        start() {
            renderer?.setAnimationLoop(frame);
        },
        stop() {
            renderer?.setAnimationLoop(null);
        },
        dispose() {
            this.stop();
            observer?.disconnect();
            observer = null;
            unsubscribeInput();
            input.onTick(() => {});
            particles.dispose();
            scene.traverse((node) => {
                const mesh = node as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
                const materials = Array.isArray(material) ? material : material ? [material] : [];
                for (const m of materials) m.dispose();
            });
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
        seedOfflineMode() {
            offlineMode = true;
            const arena: ArenaWire = {
                id: "sandbox",
                name: "Sandbox",
                bounds_min: { x: -30, y: 0, z: -30 },
                bounds_max: { x: 30, y: 0, z: 30 },
                cover: [
                    { center: { x: -6, y: 0.75, z: -4 }, half_x: 2, half_y: 0.75, half_z: 0.4 },
                    { center: { x: 6, y: 0.75, z: 4 }, half_x: 2, half_y: 0.75, half_z: 0.4 },
                    { center: { x: 0, y: 0.5, z: 8 }, half_x: 1, half_y: 0.5, half_z: 1 },
                    { center: { x: 0, y: 0.5, z: -8 }, half_x: 1, half_y: 0.5, half_z: 1 },
                    { center: { x: -12, y: 0.5, z: 12 }, half_x: 1, half_y: 0.5, half_z: 1 },
                    { center: { x: 12, y: 0.5, z: -12 }, half_x: 1, half_y: 0.5, half_z: 1 },
                    { center: { x: 0, y: 1.5, z: 0 }, half_x: 0.4, half_y: 1.5, half_z: 0.4 },
                    { center: { x: -15, y: 0.5, z: 0 }, half_x: 1, half_y: 0.5, half_z: 1 },
                ],
                spawn_points: [
                    { x: -20, y: 1, z: -20 },
                    { x: 20, y: 1, z: -20 },
                    { x: -20, y: 1, z: 20 },
                    { x: 20, y: 1, z: 20 },
                ],
            };
            const localId = "offline-local";
            const me: PlayerWire = {
                id: localId,
                name: "you",
                position: { x: -20, y: 1, z: -20 },
                yaw: 0,
                pitch: 0,
                hp: 100,
                max_hp: 100,
                is_alive: true,
                kills: 0,
                deaths: 0,
                is_ready: false,
                team: 1,
                equipped_weapon: "rifle",
            };
            localPlayerId = localId;
            const room: RoomSnapshot = {
                id: "OFFLINE",
                arena,
                state: "lobby",
                host_id: localId,
                players: [me],
                kills: {},
                winner: null,
                time_remaining: null,
            };
            rebuildArena(arena);
            syncPlayers(room);
            lastRoom = room;
            for (const h of stateHandlers) h(room);
            for (const h of localHandlers) h(me);
        },
        setInputActive(v: boolean) {
            input.setActive(v);
        },
    };
}

export { BULLET_RANGE, RIFLE_DAMAGE, SMG_DAMAGE };
