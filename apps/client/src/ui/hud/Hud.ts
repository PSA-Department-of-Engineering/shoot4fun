/* HUD overlay.
 *
 * Crosshair, health, ammo, score, hit feedback and the respawn
 * countdown. Deliberately imperative: it is written from the server
 * snapshot as fast as snapshots arrive, and routing that through a
 * component tree would spend a diff per tick on nine text nodes.
 *
 * It is read-only. Every value comes from the snapshot, and nothing here
 * decides anything about the match.
 *
 * Colour lives in `theme.css`, so the markup below carries `currentColor`
 * and class names rather than literals: the crosshair's dark-on-light
 * pairing is the foreground and background tokens, not black and white.
 */

import type { PlayerWire, RoomSnapshot } from "@/net/protocol";
import type { SessionStats } from "@/training/session";

import { ENDING_SECONDS, formatClock } from "./clock";

const HIT_MARKER_MS = 350;
const HIT_FLASH_MS = 500;

export class Hud {
    private root: HTMLElement;
    private healthFill: HTMLElement;
    private healthNumber: HTMLElement;
    private ammoNumber: HTMLElement;
    private stats: HTMLElement;
    private timer: HTMLElement;
    private respawn: HTMLElement;
    private hitIndicator: HTMLElement;
    private hitMarker: HTMLElement;
    private soloScore: HTMLElement;
    private soloHits: HTMLElement;
    private soloAccuracy: HTMLElement;
    private soloStreak: HTMLElement;
    private localId: string | null = null;
    private hitAt: number = 0;
    private hitMarkerAt: number = 0;

    constructor(parent: HTMLElement) {
        this.root = document.createElement("div");
        this.root.className = "hud";
        this.root.dataset.active = "false";
        this.root.innerHTML = `
            <svg class="hud-crosshair" viewBox="-9 -9 18 18">
                <g class="hud-crosshair-shadow" stroke-width="3" stroke-linecap="round" fill="none">
                    <line x1="-7" y1="0" x2="-3" y2="0" />
                    <line x1="7" y1="0" x2="3" y2="0" />
                    <line x1="0" y1="-7" x2="0" y2="-3" />
                    <line x1="0" y1="7" x2="0" y2="3" />
                </g>
                <g class="hud-crosshair-line" stroke-width="1" stroke-linecap="round" fill="none">
                    <line x1="-7" y1="0" x2="-3" y2="0" />
                    <line x1="7" y1="0" x2="3" y2="0" />
                    <line x1="0" y1="-7" x2="0" y2="-3" />
                    <line x1="0" y1="7" x2="0" y2="3" />
                </g>
                <circle class="hud-crosshair-dot" cx="0" cy="0" r="1.6" />
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
            <div class="hud-timer hud-number" data-timer data-visible="false">0:00</div>
            <div class="hud-stats">
                <div class="hud-secondary">KILLS &middot; DEATHS</div>
                <div class="hud-number hud-number-small" data-stats>0 &middot; 0</div>
            </div>
            <svg class="hud-hitmarker" data-hitmarker data-visible="false" viewBox="-12 -12 24 24">
                <g stroke-width="2.5" stroke-linecap="round" fill="none">
                    <line x1="-9" y1="-9" x2="-4" y2="-4" />
                    <line x1="9" y1="-9" x2="4" y2="-4" />
                    <line x1="-9" y1="9" x2="-4" y2="4" />
                    <line x1="9" y1="9" x2="4" y2="4" />
                </g>
            </svg>
            <div class="hud-respawn" data-respawn>RESPAWNING IN 3...</div>
            <div class="hud-hit" data-hit></div>
            <div class="hud-solo" data-solo>
                <div class="hud-solo-metric">
                    <div class="hud-secondary">SCORE</div>
                    <div class="hud-number" data-solo-score>0</div>
                </div>
                <div class="hud-solo-metric">
                    <div class="hud-secondary">HITS</div>
                    <div class="hud-number hud-number-small" data-solo-hits>0</div>
                </div>
                <div class="hud-solo-metric">
                    <div class="hud-secondary">ACCURACY</div>
                    <div class="hud-number hud-number-small" data-solo-accuracy>0%</div>
                </div>
                <div class="hud-solo-metric">
                    <div class="hud-secondary">STREAK</div>
                    <div class="hud-number hud-number-small" data-solo-streak>0</div>
                </div>
            </div>
        `;
        // The HUD carries both layouts and shows one: the match blocks, or
        // the solo range's counters (issue #15).
        this.root.dataset.mode = "match";
        parent.appendChild(this.root);
        this.healthFill = this.root.querySelector("[data-health-fill]")!;
        this.healthNumber = this.root.querySelector("[data-health-number]")!;
        this.ammoNumber = this.root.querySelector("[data-ammo]")!;
        this.stats = this.root.querySelector("[data-stats]")!;
        this.timer = this.root.querySelector("[data-timer]")!;
        this.respawn = this.root.querySelector("[data-respawn]")!;
        this.hitIndicator = this.root.querySelector("[data-hit]")!;
        this.hitMarker = this.root.querySelector("[data-hitmarker]")!;
        this.soloScore = this.root.querySelector("[data-solo-score]")!;
        this.soloHits = this.root.querySelector("[data-solo-hits]")!;
        this.soloAccuracy = this.root.querySelector("[data-solo-accuracy]")!;
        this.soloStreak = this.root.querySelector("[data-solo-streak]")!;
    }

    setLocalPlayer(id: string): void {
        this.localId = id;
    }

    /* The HUD stays mounted between matches so its elements are always
     * measurable, but a crosshair floating over a menu is noise. */
    setActive(active: boolean): void {
        this.root.dataset.active = String(active);
    }

    /* Enter or leave the solo range's layout (issue #15): the match's
     * health, ammo and kill/death blocks give way to the range's score,
     * hits, accuracy and streak, and the HUD is lit while the range runs
     * and dimmed when it is left. */
    setSoloActive(active: boolean): void {
        this.root.dataset.mode = active ? "solo" : "match";
        this.root.dataset.active = String(active);
        if (!active) this.timer.dataset.visible = "false";
    }

    /** Write the solo range's live counters. Called once per drawn frame
     * while the range runs; the timer is the round's own countdown. */
    updateTraining(stats: SessionStats): void {
        this.soloScore.textContent = String(stats.score);
        this.soloHits.textContent = String(stats.hits);
        this.soloAccuracy.textContent = `${Math.round(stats.accuracy * 100)}%`;
        this.soloStreak.textContent = String(stats.streak);
        const seconds = stats.remainingMs / 1000;
        this.timer.dataset.visible = "true";
        this.timer.textContent = formatClock(seconds);
        this.timer.dataset.ending = String(seconds <= ENDING_SECONDS);
    }

    flashHit(direction: number = 0): void {
        this.hitAt = performance.now();
        const degrees = (direction * 180) / Math.PI;
        this.hitIndicator.innerHTML = `
            <svg class="hud-hit-arrow" viewBox="0 0 100 100" width="100%" height="100%">
                <g transform="rotate(${degrees} 50 50)">
                    <polygon points="50,5 60,30 80,30 65,45 70,75 50,60 30,75 35,45 20,30 40,30" />
                </g>
            </svg>
        `;
    }

    /** Confirm one of our own shots landed. */
    markHit(headshot: boolean, killed: boolean): void {
        this.hitMarker.setAttribute("data-visible", "true");
        this.hitMarker.setAttribute(
            "data-kind",
            killed ? "kill" : headshot ? "headshot" : "hit",
        );
        this.hitMarkerAt = performance.now();
    }

    update(room: RoomSnapshot): void {
        const me = room.players.find((p) => p.id === this.localId) ?? null;
        if (me) {
            this.healthNumber.textContent = String(me.hp);
            this.healthFill.style.width = `${(me.hp / me.max_hp) * 100}%`;
            this.healthFill.dataset.low = String(me.hp <= me.max_hp * 0.3);
            this.ammoNumber.textContent = me.is_reloading
                ? "RELOADING"
                : `${me.ammo} / ${me.magazine_size}`;
            this.stats.textContent = `${me.kills} · ${me.deaths}`;
            this.respawn.setAttribute("data-visible", String(!me.is_alive));
            if (!me.is_alive) {
                // The claim is a countdown, so it counts down.
                this.respawn.textContent = `RESPAWNING IN ${Math.ceil(me.respawn_in)}...`;
            }
        }
        /* The match clock is one thing for the whole room, not a per-player
         * value: the server sends it only while a match runs (null in the
         * lobby and the results), so the timer shows exactly then, and warns
         * once the end is close. */
        const remaining = room.time_remaining;
        if (remaining === null) {
            this.timer.dataset.visible = "false";
        } else {
            this.timer.dataset.visible = "true";
            this.timer.textContent = formatClock(remaining);
            this.timer.dataset.ending = String(remaining <= ENDING_SECONDS);
        }
        const now = performance.now();
        if (this.hitAt > 0 && now - this.hitAt > HIT_FLASH_MS) {
            this.hitIndicator.innerHTML = "";
            this.hitAt = 0;
        }
        if (this.hitMarkerAt > 0 && now - this.hitMarkerAt > HIT_MARKER_MS) {
            this.hitMarker.setAttribute("data-visible", "false");
            this.hitMarkerAt = 0;
        }
    }

    destroy(): void {
        this.root.remove();
    }
}

export type { PlayerWire };
