/* The imperative half of the client, behind one door.
 *
 * The scene, the socket and the HUD are framework-agnostic modules that
 * run at frame rate. This module owns all three and publishes what they
 * produce as plain data, so no Three.js object, WebSocket or HUD node
 * ever reaches React state, props or context.
 *
 * Traffic is one way in each direction: views call viewmodels, viewmodels
 * call the commands here, and everything coming back arrives through the
 * listeners. Nothing in this file imports a viewmodel or a view, which is
 * what keeps the cycle from forming.
 *
 * The runtime is a singleton for the document's lifetime because the
 * things it owns are: one WebGL context, one socket, one pointer-lock
 * target.
 */

import type { TouchInput } from "@/input/InputController";
import { MatchClient, type ConnectionStatus } from "@/net/MatchClient";
import type { PlayerWire, RoomSnapshot } from "@/net/protocol";
import { createSceneApp, type SceneApp, type TrainingUpdate } from "@/scene/SceneApp";
import { Hud } from "@/ui/hud/Hud";

export type { TrainingUpdate };

export type { ConnectionStatus };

export interface ServerError {
    code: string;
    detail: string;
}

export interface GameRuntime {
    /** Mount the 3D scene into the host element and run its loop. */
    attachScene(host: HTMLElement): void;
    /** Stop the loop. The renderer stays with the host element, which the
     * component that supplied it owns and removes. */
    detachScene(): void;
    /** Mount the frame-rate HUD into the host element. */
    attachHud(host: HTMLElement): void;
    detachHud(): void;
    /** Open a socket for this name and room, replacing any open one. */
    join(name: string, roomId: string): Promise<void>;
    setReady(ready: boolean): void;
    selectMap(arenaId: string): void;
    startMatch(): void;
    rematch(): void;
    /** Enter the solo aim-training range (issue #15): the scene runs the
     * range and the HUD switches to its counters until `exitTraining`. */
    enterTraining(): void;
    /** Leave the range, free the mouse, and dim the HUD. */
    exitTraining(): void;
    /** Ask for pointer lock. Only meaningful inside a user gesture. */
    requestLock(): Promise<boolean>;
    /** Drop pointer lock, so a menu can take the mouse (the solo results
     * card needs the cursor back). */
    releaseLock(): void;
    isLocked(): boolean;
    /** The touch layout's input channel (issue #17), for the on-screen
     * controls a mobile player drives instead of mouse and keyboard. */
    touchInput(): TouchInput;
    /** Start audio from a touch gesture, since a phone never takes the
     * pointer lock that starts it on desktop. */
    resumeAudio(): void;
    /** Round-trip time in milliseconds from the last answered ping. */
    latency(): number;
    onSnapshot(cb: (room: RoomSnapshot) => void): () => void;
    onLocalPlayer(cb: (player: PlayerWire) => void): () => void;
    onStatus(cb: (status: ConnectionStatus) => void): () => void;
    onLockedChange(cb: (locked: boolean) => void): () => void;
    onServerError(cb: (error: ServerError) => void): () => void;
    /** Live solo-range counters and the end-of-round flag, each drawn
     * frame while the range runs. */
    onTraining(cb: (update: TrainingUpdate) => void): () => void;
}

function createGameRuntime(): GameRuntime {
    const scene: SceneApp = createSceneApp();

    const snapshotListeners = new Set<(room: RoomSnapshot) => void>();
    const localListeners = new Set<(player: PlayerWire) => void>();
    const statusListeners = new Set<(status: ConnectionStatus) => void>();
    const errorListeners = new Set<(error: ServerError) => void>();
    const trainingListeners = new Set<(update: TrainingUpdate) => void>();

    let sceneHost: HTMLElement | null = null;
    let hud: Hud | null = null;
    let client: MatchClient | null = null;

    /* The last of each, so a listener that subscribes after the fact is
     * not left blank until the next message. The HUD in particular is
     * mounted and unmounted by React, and a freshly mounted HUD showing
     * a default 100 hit points over a dying player is a lie. */
    let lastSnapshot: RoomSnapshot | null = null;
    let localPlayerId = "";
    /* Whether the solo range is on, kept so a HUD remounted mid-range
     * comes back into its solo layout rather than the match one. */
    let soloActive = false;

    scene.onState((room) => {
        lastSnapshot = room;
        hud?.setActive(room.state === "playing");
        hud?.update(room);
        for (const listener of snapshotListeners) listener(room);
    });

    scene.onLocalPlayer((player) => {
        localPlayerId = player.id;
        hud?.setLocalPlayer(player.id);
        for (const listener of localListeners) listener(player);
    });

    scene.onHitConfirmed((headshot, killed) => hud?.markHit(headshot, killed));

    /* Being shot from behind is the one thing the camera cannot show, so
     * the bearing of whoever fired becomes an arrow around the crosshair. */
    scene.onDamaged((direction) => hud?.flashHit(direction));

    /* The solo range writes its counters into the same imperative HUD the
     * match uses, and hands the end-of-round flag out to the overlay. */
    scene.onTraining((update) => {
        hud?.updateTraining(update.stats);
        for (const listener of trainingListeners) listener(update);
    });

    return {
        attachScene(host) {
            /* A WebGL context is expensive and single: mounting is done
             * once, and a second call for the same host only resumes the
             * loop a previous detach stopped. */
            if (sceneHost !== host) {
                sceneHost = host;
                scene.mount(host);
            }
            scene.start();
        },
        detachScene() {
            scene.stop();
        },
        attachHud(host) {
            hud?.destroy();
            hud = new Hud(host);
            if (localPlayerId) hud.setLocalPlayer(localPlayerId);
            if (soloActive) {
                hud.setSoloActive(true);
            } else if (lastSnapshot) {
                hud.setActive(lastSnapshot.state === "playing");
                hud.update(lastSnapshot);
            }
        },
        detachHud() {
            hud?.destroy();
            hud = null;
        },
        async join(name, roomId) {
            client?.close();
            const next = new MatchClient(roomId, name);
            client = next;
            next.onStatus((status) => {
                for (const listener of statusListeners) listener(status);
            });
            next.on((msg) => {
                if (msg.type !== "error") return;
                const error = { code: msg.code, detail: msg.detail ?? "" };
                for (const listener of errorListeners) listener(error);
            });
            scene.bindMatch(next);
            await next.connect();
        },
        setReady(ready) {
            client?.setReady(ready);
        },
        selectMap(arenaId) {
            client?.selectMap(arenaId);
        },
        startMatch() {
            client?.startMatch();
        },
        rematch() {
            client?.rematch();
        },
        enterTraining() {
            soloActive = true;
            hud?.setSoloActive(true);
            scene.enterTraining();
        },
        exitTraining() {
            scene.exitTraining();
            scene.releaseLock();
            soloActive = false;
            hud?.setSoloActive(false);
        },
        requestLock() {
            return scene.requestLock();
        },
        releaseLock() {
            scene.releaseLock();
        },
        isLocked() {
            return scene.isLocked();
        },
        touchInput() {
            return scene.touchInput();
        },
        resumeAudio() {
            scene.resumeAudio();
        },
        latency() {
            return client?.latency() ?? 0;
        },
        onSnapshot(cb) {
            snapshotListeners.add(cb);
            if (lastSnapshot) cb(lastSnapshot);
            return () => snapshotListeners.delete(cb);
        },
        onLocalPlayer(cb) {
            localListeners.add(cb);
            return () => localListeners.delete(cb);
        },
        onStatus(cb) {
            statusListeners.add(cb);
            return () => statusListeners.delete(cb);
        },
        onLockedChange(cb) {
            return scene.onLockedChange(cb);
        },
        onServerError(cb) {
            errorListeners.add(cb);
            return () => errorListeners.delete(cb);
        },
        onTraining(cb) {
            trainingListeners.add(cb);
            return () => trainingListeners.delete(cb);
        },
    };
}

let runtime: GameRuntime | null = null;

/** The client's one runtime, created on first use. */
export function getGameRuntime(): GameRuntime {
    if (!runtime) runtime = createGameRuntime();
    return runtime;
}
