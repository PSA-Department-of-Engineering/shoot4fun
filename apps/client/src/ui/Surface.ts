/* Lobby, results, settings DOM surfaces.
 * The three are separate views gated by the match state machine
 * (INT-011). The DOM reads brand tokens via theme.css; no inline
 * colours. The DOM is appended to a host element and removed on
 * transition.
 */

import type { MatchClient } from "../net/MatchClient";
import type { RoomSnapshot } from "../net/protocol";

export type ViewKind = "lobby" | "results" | "settings" | "leaderboard";

export class Surface {
    private host: HTMLElement;
    private current: ViewKind | null = null;

    constructor(host: HTMLElement) {
        this.host = host;
    }

    show(view: ViewKind, ctx: SurfaceContext): void {
        if (this.current === view) {
            this.update(view, ctx);
            return;
        }
        this.current = view;
        this.host.innerHTML = render(view, ctx);
        wireUp(view, ctx);
    }

    hide(): void {
        this.host.innerHTML = "";
        this.current = null;
    }

    update(view: ViewKind, ctx: SurfaceContext): void {
        if (this.current !== view) return;
        const root = this.host.querySelector(".card");
        if (!root) return;
        root.innerHTML = renderBody(view, ctx);
        wireUp(view, ctx);
    }
}

export interface SurfaceContext {
    room: RoomSnapshot | null;
    localPlayerId: string;
    client: MatchClient;
    onClose: () => void;
}

function render(view: ViewKind, ctx: SurfaceContext): string {
    return `
        <div class="surface">
            <div class="card">${renderBody(view, ctx)}</div>
        </div>
    `;
}

function renderBody(view: ViewKind, ctx: SurfaceContext): string {
    if (view === "lobby") return renderLobby(ctx);
    if (view === "results") return renderResults(ctx);
    if (view === "settings") return renderSettings(ctx);
    if (view === "leaderboard") return renderLeaderboard(ctx);
    return "";
}

function renderLobby(ctx: SurfaceContext): string {
    const room = ctx.room;
    if (!room) return `<h1>Loading...</h1>`;
    const me = room.players.find((p) => p.id === ctx.localPlayerId);
    const isHost = room.host_id === ctx.localPlayerId;
    const allReady = room.players.length >= 2 && room.players.every((p) => p.is_ready);
    const playerCards = room.players
        .map(
            (p) => `
            <div class="row" style="gap:.75rem; padding:.5rem; border:1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--card));">
                <span style="display:inline-block; width:18px; height:18px; border-radius:50%; background: hsl(${p.team === 2 ? "195 100% 50%" : "12 95% 55%"});"></span>
                <span>${escapeHtml(p.name)}${p.id === room.host_id ? " (host)" : ""}</span>
                <span style="margin-left:auto; color: hsl(var(--muted-foreground)); font-size:.875rem;">${p.is_ready ? "READY" : "..."}</span>
            </div>
        `,
        )
        .join("");
    const mapOptions = ["sandbox", "atrium"]
        .map(
            (id) => `<option value="${id}" ${room.arena.id === id ? "selected" : ""}>${id}</option>`,
        )
        .join("");
    return `
        <h1>ROOM <span style="font-family: var(--font-mono);">${room.id}</span></h1>
        <p>Share the room code with another player to start a match.</p>
        <h2>Players (${room.players.length} / 4)</h2>
        <div class="grid-2">${playerCards}</div>
        <h2>Map</h2>
        <select class="input" data-map ${isHost ? "" : "disabled"}>${mapOptions}</select>
        <div class="row" style="margin-top:1rem; gap:.5rem;">
            <button class="btn" data-ready>${me?.is_ready ? "Cancel ready" : "Ready"}</button>
            ${isHost ? `<button class="btn btn-primary" data-start ${allReady ? "" : "disabled"}>Start match</button>` : ""}
        </div>
    `;
}

function renderResults(ctx: SurfaceContext): string {
    const room = ctx.room;
    if (!room) return `<h1>Results</h1>`;
    const sorted = [...room.players].sort((a, b) => b.kills - a.kills);
    const rows = sorted
        .map(
            (p, i) => `
            <div class="leaderboard-row ${i === 0 ? "first" : ""}">
                <span class="place">#${i + 1}</span>
                <span>${escapeHtml(p.name)}</span>
                <span style="text-align:right;">${p.kills} kill${p.kills === 1 ? "" : "s"}</span>
            </div>
        `,
        )
        .join("");
    const isHost = room.host_id === ctx.localPlayerId;
    return `
        <h1>MATCH OVER</h1>
        <p>${room.winner ? `Winner: ${escapeHtml(sorted[0]?.name ?? "?")}` : "No winner."}</p>
        <div style="display:flex; flex-direction:column; gap:.5rem; margin-top:1rem;">${rows}</div>
        <div class="row" style="margin-top:1rem; gap:.5rem;">
            ${isHost ? '<button class="btn btn-primary" data-rematch>Rematch</button>' : ""}
            <button class="btn" data-leaderboard>Best scores</button>
            <button class="btn" data-close>Back to lobby</button>
        </div>
    `;
}

function renderSettings(_ctx: SurfaceContext): string {
    const master = Number(window.localStorage.getItem("sf_master_volume") ?? 0.7);
    const sfx = Number(window.localStorage.getItem("sf_sfx_volume") ?? 0.8);
    const sensitivity = Number(window.localStorage.getItem("sf_sensitivity") ?? 0.0025);
    return `
        <h1>Settings</h1>
        <h2>Audio</h2>
        <label>Master volume <input class="input" type="range" min="0" max="1" step="0.01" value="${master}" data-master></label>
        <label>SFX volume <input class="input" type="range" min="0" max="1" step="0.01" value="${sfx}" data-sfx></label>
        <h2>Mouse</h2>
        <label>Sensitivity <input class="input" type="range" min="0.0005" max="0.005" step="0.0001" value="${sensitivity}" data-sensitivity></label>
        <h2>Keybinds</h2>
        <p style="font-family: var(--font-mono);">W A S D — move · Mouse — look · Click — fire · 1 / 2 — weapon · R — reload · ESC — pause · M — master mute · S — SFX mute</p>
        <div class="row" style="margin-top:1rem; gap:.5rem;">
            <button class="btn" data-close>Close</button>
        </div>
    `;
}

function renderLeaderboard(_ctx: SurfaceContext): string {
    return `
        <h1>Best scores</h1>
        <div data-leaderboard-body>Loading...</div>
        <div class="row" style="margin-top:1rem; gap:.5rem;">
            <button class="btn" data-close>Back</button>
        </div>
    `;
}

function wireUp(view: ViewKind, ctx: SurfaceContext): void {
    if (view === "lobby") {
        bindClick(ctx, "[data-ready]", () => {
            const me = ctx.room?.players.find((p) => p.id === ctx.localPlayerId);
            ctx.client.setReady(!(me?.is_ready ?? false));
        });
        bindClick(ctx, "[data-start]", () => ctx.client.startMatch());
        const mapSel = document.querySelector("[data-map]") as HTMLSelectElement | null;
        if (mapSel) {
            mapSel.addEventListener("change", () => {
                // Map change is local-only; server picks arena by id at start
            });
        }
    } else if (view === "results") {
        bindClick(ctx, "[data-rematch]", () => ctx.client.rematch());
        bindClick(ctx, "[data-leaderboard]", () => {
            ctx.onClose();
            // Surface switches to leaderboard via parent
        });
        bindClick(ctx, "[data-close]", () => ctx.onClose());
    } else if (view === "settings") {
        const master = document.querySelector("[data-master]") as HTMLInputElement | null;
        const sfx = document.querySelector("[data-sfx]") as HTMLInputElement | null;
        const sens = document.querySelector("[data-sensitivity]") as HTMLInputElement | null;
        if (master) {
            master.addEventListener("input", () => {
                window.localStorage.setItem("sf_master_volume", master.value);
                window.dispatchEvent(new StorageEvent("storage", { key: "sf_master_volume" }));
            });
        }
        if (sfx) {
            sfx.addEventListener("input", () => {
                window.localStorage.setItem("sf_sfx_volume", sfx.value);
                window.dispatchEvent(new StorageEvent("storage", { key: "sf_sfx_volume" }));
            });
        }
        if (sens) {
            sens.addEventListener("input", () => {
                window.localStorage.setItem("sf_sensitivity", sens.value);
            });
        }
        bindClick(ctx, "[data-close]", () => ctx.onClose());
    } else if (view === "leaderboard") {
        bindClick(ctx, "[data-close]", () => ctx.onClose());
        loadLeaderboard();
    }
}

function bindClick(_ctx: SurfaceContext, selector: string, fn: () => void): void {
    const el = document.querySelector(selector);
    if (el) el.addEventListener("click", fn);
}

async function loadLeaderboard(): Promise<void> {
    const body = document.querySelector("[data-leaderboard-body]");
    if (!body) return;
    body.innerHTML = "<p class='muted-text'>Loading…</p>";
    try {
        const res = await fetch("/api/leaderboard/sandbox");
        if (!res.ok) {
            body.innerHTML = "<p class='muted-text'>No scores yet.</p>";
            return;
        }
        const data = await res.json();
        body.innerHTML = `
            <div class="leaderboard-row first">
                <span class="place">#1</span>
                <span>${escapeHtml(data.holder_name ?? "?")}</span>
                <span style="text-align:right;">${data.best_score}</span>
            </div>
        `;
    } catch {
        body.innerHTML = "<p class='muted-text'>Offline.</p>";
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c;
    });
}
