/* Shoot4Fun entry point. Wires:
 *  - the Three.js scene (src/scene/SceneApp.ts)
 *  - the WebSocket match client (src/net/MatchClient.ts)
 *  - the DOM surface for lobby / results / settings / leaderboard
 *  - the HUD overlay
 *  - the room routing (room id from URL hash, fallback to a generated one)
 */

import { createSceneApp } from "./scene/SceneApp";
import { Hud } from "./ui/Hud";
import { Surface } from "./ui/Surface";
import { MatchClient } from "./net/MatchClient";
import type { RoomSnapshot } from "./net/protocol";
import "./brand/theme.css";

const CONTAINER_ID = "app";
const SURFACE_ID = "surface";

function getRoomId(): string {
    const hash = window.location.hash.replace(/^#\/?/, "").trim();
    if (hash) return hash;
    return randomRoom();
}

function randomRoom(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    window.location.hash = `/${s}`;
    return s;
}

function getPlayerName(): string {
    const stored = window.localStorage.getItem("sf_player_name");
    if (stored) return stored;
    const name = window.prompt("Enter your name", `Player${Math.floor(Math.random() * 1000)}`) ?? "anon";
    const trimmed = name.slice(0, 32);
    window.localStorage.setItem("sf_player_name", trimmed);
    return trimmed;
}

const container = document.getElementById(CONTAINER_ID);
if (!container) throw new Error("missing #app container");

const scene = createSceneApp();
scene.mount(container);
scene.start();

const surfaceHost = document.createElement("div");
surfaceHost.id = SURFACE_ID;
document.body.appendChild(surfaceHost);
const surface = new Surface(surfaceHost);
const hud = new Hud(document.body);

const query = new URLSearchParams(window.location.search);
const forceOffline = query.get("offline") === "1" || window.location.search.includes("offline=1");
const noAutoConnect = query.has("noAutoConnect");

const roomId = getRoomId();
const playerName = getPlayerName();
const client = new MatchClient(roomId, playerName);
scene.bindMatch(client);

const ctx = {
    room: null as RoomSnapshot | null,
    localPlayerId: "",
    client,
    onClose: () => surface.hide(),
};

scene.onState((room) => {
    ctx.room = room;
    if (room.state === "lobby") surface.show("lobby", ctx);
    else if (room.state === "results") surface.show("results", ctx);
    else surface.hide();
    hud.update(room);
});

scene.onLocalPlayer((player) => {
    ctx.localPlayerId = player.id;
    hud.setLocalPlayer(player.id);
});

if (forceOffline) {
    scene.seedOfflineMode();
    scene.setInputActive(true);
} else if (!noAutoConnect) {
    client
        .connect()
        .then(() => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.background = "hsl(var(--background))";
            overlay.style.zIndex = "40";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.innerHTML = `<div class="card" style="text-align:center;"><h1>SHOOT4FUN</h1><p>Click to play</p></div>`;
            document.body.appendChild(overlay);
            overlay.addEventListener("click", () => {
                overlay.remove();
            });
        })
        .catch(() => {
            // Offline mode fallback: seed the scene with a default room so
            // the e2e surface (camera, position, arena, particles) is alive.
            const overlay = document.createElement("div");
            overlay.className = "toast";
            overlay.textContent = "Backend offline — running in offline mode.";
            document.body.appendChild(overlay);
            scene.seedOfflineMode();
            scene.setInputActive(true);
        });
}

// Expose the seed for tests that need to skip the WebSocket round-trip.
(window as unknown as { __sfSeedOfflineMode: () => void }).__sfSeedOfflineMode = () => {
    scene.seedOfflineMode();
};

