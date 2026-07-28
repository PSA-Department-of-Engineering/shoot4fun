/* HUD overlay.
 * Renders crosshair, health bar, ammo, scoreboard summary, hit
 * indicator, and the respawn countdown. The DOM is mounted into a
 * single `<div class="hud">` and updated by `update(state, localId)`.
 * All values come from the server snapshot — the HUD is read-only.
 */

import type { PlayerWire, RoomSnapshot } from "../net/protocol";

const WEAPON_AMMO: Record<string, { mag: number; reserve: number }> = {
    rifle: { mag: 30, reserve: 90 },
    smg: { mag: 40, reserve: 120 },
};

export class Hud {
    private root: HTMLElement;
    private healthFill: HTMLElement;
    private healthNumber: HTMLElement;
    private ammoNumber: HTMLElement;
    private stats: HTMLElement;
    private respawn: HTMLElement;
    private hitIndicator: HTMLElement;
    private localId: string | null = null;
    private hitAt: number = 0;

    constructor(parent: HTMLElement) {
        this.root = document.createElement("div");
        this.root.className = "hud";
        this.root.innerHTML = `
            <svg class="hud-crosshair" viewBox="-9 -9 18 18">
                <g stroke="black" stroke-width="3" stroke-linecap="round" fill="none">
                    <line x1="-7" y1="0" x2="-3" y2="0" />
                    <line x1="7" y1="0" x2="3" y2="0" />
                    <line x1="0" y1="-7" x2="0" y2="-3" />
                    <line x1="0" y1="7" x2="0" y2="3" />
                </g>
                <g stroke="white" stroke-width="1" stroke-linecap="round" fill="none">
                    <line x1="-7" y1="0" x2="-3" y2="0" />
                    <line x1="7" y1="0" x2="3" y2="0" />
                    <line x1="0" y1="-7" x2="0" y2="-3" />
                    <line x1="0" y1="7" x2="0" y2="3" />
                </g>
                <circle cx="0" cy="0" r="1.6" fill="black" />
            </svg>
            <div class="hud-health">
                <div class="hud-number" data-health-number>100</div>
                <div class="hud-health-bar">
                    <div class="hud-health-fill" data-health-fill style="width: 100%"></div>
                </div>
            </div>
            <div class="hud-ammo">
                <div class="hud-number" data-ammo>30 / 90</div>
            </div>
            <div class="hud-stats">
                <div class="hud-secondary">KILLS · DEATHS</div>
                <div class="hud-number" style="font-size: 24px" data-stats>0 · 0</div>
            </div>
            <div class="hud-respawn" data-respawn>RESPAWNING IN 3...</div>
            <div class="hud-hit" data-hit style="position:absolute; inset:0; pointer-events: none;"></div>
        `;
        parent.appendChild(this.root);
        this.healthFill = this.root.querySelector("[data-health-fill]")!;
        this.healthNumber = this.root.querySelector("[data-health-number]")!;
        this.ammoNumber = this.root.querySelector("[data-ammo]")!;
        this.stats = this.root.querySelector("[data-stats]")!;
        this.respawn = this.root.querySelector("[data-respawn]")!;
        this.hitIndicator = this.root.querySelector("[data-hit]")!;
    }

    setLocalPlayer(id: string): void {
        this.localId = id;
    }

    flashHit(direction: number = 0): void {
        this.hitAt = performance.now();
        const a = (direction * 180) / Math.PI;
        this.hitIndicator.innerHTML = `
            <svg viewBox="0 0 100 100" width="100%" height="100%" style="opacity:0.8">
                <g transform="rotate(${a} 50 50)" fill="hsl(0 72% 51%)" stroke="black" stroke-width="1.5">
                    <polygon points="50,5 60,30 80,30 65,45 70,75 50,60 30,75 35,45 20,30 40,30" />
                </g>
            </svg>
        `;
    }

    update(room: RoomSnapshot): void {
        const me = room.players.find((p) => p.id === this.localId) ?? null;
        if (me) {
            this.healthNumber.textContent = String(me.hp);
            this.healthFill.style.width = `${(me.hp / me.max_hp) * 100}%`;
            this.ammoNumber.textContent = formatAmmo(me.equipped_weapon);
            this.stats.textContent = `${me.kills} · ${me.deaths}`;
            if (!me.is_alive) {
                this.respawn.setAttribute("data-visible", "true");
            } else {
                this.respawn.setAttribute("data-visible", "false");
            }
        }
        if (this.hitAt > 0) {
            const elapsed = performance.now() - this.hitAt;
            if (elapsed > 500) {
                this.hitIndicator.innerHTML = "";
                this.hitAt = 0;
            }
        }
    }

    destroy(): void {
        this.root.remove();
    }
}

function formatAmmo(weapon: string): string {
    const a = WEAPON_AMMO[weapon] ?? WEAPON_AMMO.rifle;
    return `${a.mag} / ${a.reserve}`;
}

export type { PlayerWire };
