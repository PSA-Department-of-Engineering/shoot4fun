/* Shoot4Fun entry point.
 *
 * Wires the scene, the socket, the HUD and the DOM surfaces, and owns
 * the one thing a first-person game cannot work without: the pointer
 * lock lifecycle.
 *
 * Pointer lock can only be taken during a real user gesture, and the
 * player can drop it at any time with Escape. So the overlay is not
 * decoration: it is the gesture surface. It is up whenever the lock is
 * not held, and taking the lock is what dismisses it.
 */

import { createSceneApp } from "./scene/SceneApp";
import { Hud } from "./ui/Hud";
import { Surface } from "./ui/Surface";
import { MatchClient } from "./net/MatchClient";
import type { RoomSnapshot } from "./net/protocol";
import "./brand/theme.css";

const container = document.getElementById("app");
if (!container) throw new Error("missing #app container");

const scene = createSceneApp();
scene.mount(container);
scene.start();

const surfaceHost = document.createElement("div");
surfaceHost.id = "surface";
document.body.appendChild(surfaceHost);
const surface = new Surface(surfaceHost);
const hud = new Hud(document.body);

const gate = buildGate();
document.body.appendChild(gate.root);

const roomId = readRoomId();
const client = new MatchClient(roomId, readPlayerName());
scene.bindMatch(client);

const ctx = {
    room: null as RoomSnapshot | null,
    localPlayerId: "",
    client,
    onClose: () => surface.hide(),
};

let matchState: RoomSnapshot["state"] = "lobby";

scene.onState((room) => {
    ctx.room = room;
    matchState = room.state;
    if (room.state === "lobby") surface.show("lobby", ctx);
    else if (room.state === "results") surface.show("results", ctx);
    else surface.hide();
    hud.update(room);
    refreshGate();
});

scene.onLocalPlayer((player) => {
    ctx.localPlayerId = player.id;
    hud.setLocalPlayer(player.id);
});

scene.onHitConfirmed((headshot, killed) => hud.markHit(headshot, killed));
scene.onLockedChange(() => refreshGate());

/* The gate covers the canvas whenever the game does not have the mouse.
 * During a match that means "click to play"; in the lobby and on the
 * results screen the menus are the point, so it stays out of the way. */
function refreshGate(): void {
    const wantsLock = matchState === "playing" && !scene.isLocked();
    gate.root.style.display = wantsLock ? "flex" : "none";
}

function buildGate(): { root: HTMLElement } {
    const root = document.createElement("div");
    root.className = "gate";
    root.dataset.gate = "pointer-lock";
    root.style.display = "none";
    root.innerHTML = `
        <div class="card" style="text-align:center;">
            <h1 class="wordmark">SHOOT4FUN</h1>
            <p data-gate-message>Click to play</p>
            <p class="muted-text" style="font-family: var(--font-mono); font-size:.8rem;">
                WASD move &middot; mouse look &middot; click fire &middot; 1 / 2 weapon &middot; R reload &middot; ESC release
            </p>
        </div>
    `;
    root.addEventListener("click", () => {
        void scene.requestLock().then((locked) => {
            const message = root.querySelector("[data-gate-message]");
            if (!locked && message) {
                // The browser refuses a re-request for a moment after
                // Escape, so say what happened instead of looking dead.
                message.textContent = "Click again to capture the mouse";
            }
            refreshGate();
        });
    });
    return { root };
}

function readRoomId(): string {
    const hash = window.location.hash.replace(/^#\/?/, "").trim();
    if (hash) return hash.toUpperCase().slice(0, 8);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let generated = "";
    for (let i = 0; i < 6; i++) {
        generated += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    window.location.hash = `/${generated}`;
    return generated;
}

function readPlayerName(): string {
    const stored = window.localStorage.getItem("sf_player_name");
    if (stored) return stored;
    const generated = `Player${Math.floor(Math.random() * 1000)}`;
    window.localStorage.setItem("sf_player_name", generated);
    return generated;
}

client.connect().catch((error: Error) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.connectionError = "1";
    toast.textContent = `Cannot reach the match server: ${error.message}`;
    document.body.appendChild(toast);
});
