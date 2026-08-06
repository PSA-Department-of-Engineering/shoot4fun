/* The game, played.
 *
 * Two real browsers against a real server, driving the controls a
 * player uses. Every assertion here is on an observable outcome: the
 * camera turned, the player travelled a bounded distance, a wall
 * stopped them, an opponent's hit points fell.
 *
 * These replace a suite that ran entirely against a synthetic offline
 * mode and asserted, among other things, that the string 'fire'
 * appeared in an array the production code hardcoded for it. That suite
 * was green while none of this worked.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { intent } from "./intent-shim";
import { PLAYER_RADIUS } from "../src/sim/movement";

interface DebugSurface {
    camera(): { yaw: number; pitch: number };
    position(): { x: number; y: number; z: number };
    correction(): number;
    locked(): boolean;
    remoteCount(): number;
    remotes(): { id: string; x: number; y: number; z: number; visible: boolean }[];
    coverCount(): number;
    /* The cover the room actually sent (issue #20), so a harness can
     * reason about line of fire against the real arena instead of a
     * hardcoded copy of one that can drift out of step with it. */
    cover(): { center: Vec3; half_x: number; half_y: number; half_z: number }[];
    sceneArenaId(): string;
    bounds(): { min: Vec3; max: Vec3 } | null;
    state(): string | null;
    localId(): string;
    health(): number | null;
    minHealth(): number | null;
    framesRendered(): number;
    lookYaw(): number;
    lookPitch(): number;
    ammo(): number | null;
    sentFrames(): {
        seq: number;
        dt: number;
        ackTick: number;
        yaw: number;
        pitch: number;
        forward: boolean;
        back: boolean;
        left: boolean;
        right: boolean;
        fire: boolean;
    }[];
    serverWord(): {
        yaw: number;
        pitch: number;
        ack: number;
        position: { x: number; y: number; z: number } | null;
    };
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

declare global {
    interface Window {
        __sfDebug: DebugSurface;
    }
}

const MOVE_SPEED = 6.0;

/* Eye height above the feet, matching both runtimes exactly (ADR-0002):
 * backend `PLAYER_EYE_HEIGHT` and client `SceneApp`'s `EYE_HEIGHT`. Cover
 * shorter than this cannot break a standing shot (arena.py's own doc:
 * waist- and shoulder-high cover "hides nothing standing"). */
const EYE_HEIGHT_M = 1.6;

/* Reconciliation correction (metres) below which the predicted position
 * is close enough to the server's that a shot fired from it and a shot
 * the server raycasts from its own position agree. INT-004 waits for
 * this before firing, because a stride of origin error over a 60m line
 * misses (issue #8).
 *
 * Comfortably *inside* PLAYER_RADIUS (issue #19) - the cylinder radius
 * the shot has to land inside of, not inside DESYNC_THRESHOLD, a client
 * reconciliation constant with no bearing on hit geometry (issue #23) -
 * because a position that has "settled" by this test's own definition
 * but is still most of a player-width off is not settled where it
 * counts: the origin the barrel was aimed from and the origin the
 * server raycasts from must agree to well within the cylinder, not
 * merely within some other routine's idea of "close enough". */
const DESYNC_SETTLED_M = PLAYER_RADIUS / 3;

/* The fraction of the geometric miss line (issue #19) the wire-yaw
 * tolerance in `aimOntoWire` is allowed to spend. DESYNC_SETTLED_M above
 * already spends part of PLAYER_RADIUS's budget before the shot is even
 * aimed - the two errors stack, since the yaw is computed from the
 * shooter's predicted position, not the server's actual one - so the
 * budget the yaw tolerance gets to work with is what is left of the
 * cylinder once that settle error is spent, and this keeps the tolerance
 * meaningfully inside that remaining line rather than riding it. */
const AIM_TOLERANCE_SAFETY = 0.5;

/* Every context opened by a test, closed after it.
 *
 * A browser left open keeps rendering WebGL, and the suite runs one
 * worker: a leaked page is frame time taken from every test after it,
 * on the machine least able to spare it. Closing here rather than at
 * the end of each test means no test can forget. */
const opened: BrowserContext[] = [];

test.afterEach(async () => {
    await Promise.all(opened.splice(0).map((context) => context.close()));
});

/* Optional CPU throttle, opt-in with SF_CPU_THROTTLE=<rate>.
 *
 * A CI runner rendering WebGL on SwiftShader is far slower than any
 * machine this is developed on, and frame-rate-dependent defects only
 * show there: a render frame longer than the simulation's per-frame
 * ceiling cost a slow client its walking speed, and nothing local was
 * slow enough to reveal it. Setting this reproduces that class of bug
 * on a fast machine.
 *
 *   SF_CPU_THROTTLE=8 npx playwright test e2e/match.spec.ts
 */
const CPU_THROTTLE = Number(process.env.SF_CPU_THROTTLE ?? 1);

async function joinRoom(browser: Browser, room: string, name: string): Promise<Page> {
    const context = await browser.newContext();
    opened.push(context);
    await context.addInitScript(
        ([playerName]) => window.localStorage.setItem("sf_player_name", playerName),
        [name],
    );
    const page = await context.newPage();
    if (CPU_THROTTLE > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
    }
    await page.goto(`/#/${room}`);
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    return page;
}

/** Two players in one room, in the lobby, before anyone is ready. */
async function lobby(
    browser: Browser,
    room: string,
): Promise<{ host: Page; guest: Page }> {
    const host = await joinRoom(browser, room, "e2e-host");
    const guest = await joinRoom(browser, room, "e2e-guest");

    await expect(host.locator("[data-ready]")).toBeVisible();
    await expect(guest.locator("[data-ready]")).toBeVisible();
    return { host, guest };
}

/** Two players in one room, readied up, with the match running. */
async function startedMatch(
    browser: Browser,
    room: string,
): Promise<{ host: Page; guest: Page }> {
    const { host, guest } = await lobby(browser, room);

    await host.locator("[data-ready]").click();
    await guest.locator("[data-ready]").click();

    const start = host.locator("[data-start]");
    await expect(start).toBeEnabled();
    await start.click();

    await expect(host.locator("[data-ready]")).toBeHidden();
    await expect
        .poll(() => host.evaluate(() => window.__sfDebug.state()))
        .toBe("playing");
    return { host, guest };
}

async function positionOf(page: Page): Promise<Vec3> {
    return page.evaluate(() => window.__sfDebug.position());
}

function distanceFrom(a: Vec3, b: Vec3): number {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

/* Point the camera at the opponent, through the input path a mouse
 * uses. Pointer-lock deltas are what turn the camera and Playwright's
 * mouse.move is absolute, so the turn is driven by dispatching the same
 * relative-motion event the browser delivers under lock.
 *
 * Also levels pitch on every call, not just yaw. `capturePointer`'s own
 * pitch correction is a best-effort guess at when a real click's
 * corrupting side effect (issue #8) lands, and guessing wrong just means
 * it corrects nothing. This call needs no guess: it already runs
 * continuously throughout the approach and immediately before every
 * fire, so whenever the corruption actually lands, the next aim here
 * catches and cancels it regardless of timing - the target is always at
 * the shooter's own eye height, so level pitch is always the correct
 * aim, never just a correction of convenience. */
async function aimAtOpponent(page: Page): Promise<void> {
    await page.evaluate(() => {
        const me = window.__sfDebug.position();
        const them = window.__sfDebug.remotes()[0];
        if (!them) return;
        // Forward is (-sin(yaw), 0, -cos(yaw)), so the yaw that points
        // at (dx, dz) is atan2(-dx, -dz).
        const wanted = Math.atan2(-(them.x - me.x), -(them.z - me.z));
        // Correct against where the controller is pointing, not
        // where the camera last drew: on a slow machine the two
        // differ by a frame and corrections compound into a spin.
        let delta = (wanted - window.__sfDebug.lookYaw()) % (Math.PI * 2);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        // The controller applies yaw -= movementX * sensitivity and
        // pitch -= movementY * sensitivity.
        const sensitivity =
            Number(window.localStorage.getItem("sf_sensitivity")) || 0.0022;
        window.dispatchEvent(
            new MouseEvent("mousemove", {
                movementX: -delta / sensitivity,
                movementY: window.__sfDebug.lookPitch() / sensitivity,
            }),
        );
    });
}

/** Pull or release the trigger, through the same input path aiming uses
 * rather than Playwright's own `page.mouse.down`/`up`.
 *
 * Those dispatch a real, CDP-level click at whatever position
 * Playwright's own mouse tracker last saw - and this suite's aim never
 * goes through that tracker, since `aimAtOpponent` turns the camera by
 * dispatching a synthetic `mousemove` directly, bypassing it entirely.
 * Under an active pointer lock the two fall out of step, and a real
 * click resolves against Chromium's own idea of where the cursor last
 * was: on the CI runner this showed up as a fixed ~80 degree yaw jump on
 * mouse.down, and another on mouse.up, corrupting an aim that was
 * dead-on the instant the trigger was pulled (issue #8's real cause -
 * not frame lag, a CDP/pointer-lock mismatch specific to real clicks).
 * The fix is to never issue one: fire through the same synthetic event
 * dispatch aiming already trusted, which carries no absolute position at
 * all for a locked pointer to disagree about. */
async function setTrigger(page: Page, held: boolean): Promise<void> {
    await page.evaluate((held) => {
        window.dispatchEvent(
            new MouseEvent(held ? "mousedown" : "mouseup", { button: 0 }),
        );
    }, held);
}

/** Aim until the yaw the client has actually SENT points at the opponent
 * closely enough to land the shot, or `timeoutMs` elapses.
 *
 * The tolerance is derived from the target it protects rather than a
 * round number (issue #19): PLAYER_RADIUS is the hit cylinder's own
 * radius (`_cylinder_hit`, hitscan.py), so `atan(budget / range)` of yaw
 * is the most a shot can be off by at the current range and still land,
 * where `budget` is what is left of PLAYER_RADIUS once DESYNC_SETTLED_M's
 * own error is spent. AIM_TOLERANCE_SAFETY keeps this test meaningfully
 * inside that line instead of riding it.
 *
 * `aimAtOpponent` turns the controller instantly, but the server raycasts
 * a shot from the yaw the client last put on the wire, and a frame is only
 * sent when the loop renders. On a software-rendered runner that lags the
 * held aim badly (issue #8: ~80 degrees of wire lag behind an aim-off-by
 * of zero), so a burst fired the instant the controller is on target flies
 * wide. This keeps nudging the aim, letting the frame loop run between
 * nudges, until the last frame ON THE WIRE - the one the server will shoot
 * along - is itself within tolerance of the opponent. */
async function aimOntoWire(page: Page, timeoutMs: number): Promise<boolean> {
    const until = Date.now() + timeoutMs;
    const radiusBudget = PLAYER_RADIUS - DESYNC_SETTLED_M;
    while (Date.now() < until) {
        await aimAtOpponent(page);
        const onTarget = await page.evaluate(
            ({ radiusBudget, safety }) => {
                const me = window.__sfDebug.position();
                const them = window.__sfDebug.remotes()[0];
                const sent = window.__sfDebug.sentFrames();
                const last = sent[sent.length - 1];
                if (!them || !last) return false;
                const range = Math.hypot(them.x - me.x, them.z - me.z);
                const wanted = Math.atan2(-(them.x - me.x), -(them.z - me.z));
                let d = (wanted - last.yaw) % (Math.PI * 2);
                if (d > Math.PI) d -= Math.PI * 2;
                if (d < -Math.PI) d += Math.PI * 2;
                return Math.abs(d) < safety * Math.atan(radiusBudget / range);
            },
            { radiusBudget, safety: AIM_TOLERANCE_SAFETY },
        );
        if (onTarget) return true;
        await page.waitForTimeout(100);
    }
    return false;
}

interface CoverBoxState {
    center: Vec3;
    half_x: number;
    half_y: number;
    half_z: number;
}

/** Segment-vs-box in the ground plane, by the same slab method the
 * server's hitscan uses per axis against cover (`_box_hit`, hitscan.py),
 * bounded to t in [0, 1] since this asks about a fixed pair of points
 * rather than a ray of unbounded range. Height is handled separately by
 * the caller: a box is either tall enough to matter everywhere in its
 * footprint or it is not in play at all (arena.py). */
function segmentCrossesBox(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    box: CoverBoxState,
): boolean {
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dz = bz - az;
    const axes: [number, number, number, number][] = [
        [ax, dx, box.center.x - box.half_x, box.center.x + box.half_x],
        [az, dz, box.center.z - box.half_z, box.center.z + box.half_z],
    ];
    for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) {
            if (o < lo || o > hi) return false;
            continue;
        }
        let tNear = (lo - o) / d;
        let tFar = (hi - o) / d;
        if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
        if (tNear > t0) t0 = tNear;
        if (tFar < t1) t1 = tFar;
        if (t0 > t1) return false;
    }
    return true;
}

/** Whether a standing shot from `a` to `b` clears the arena's own cover
 * (issue #20), read live off the room the server actually sent rather
 * than assumed from one spawn: the previous approach reasoned about a
 * single hardcoded block from the spawn point and never re-checked that
 * reasoning against where the shooter actually ended up. Only cover
 * tall enough to break a standing shot is in play (arena.py's own doc:
 * waist- and shoulder-high cover "hides nothing standing"). */
function hasLineOfFire(
    a: { x: number; z: number },
    b: { x: number; z: number },
    cover: CoverBoxState[],
): boolean {
    return !cover.some(
        (box) =>
            box.half_y * 2 >= EYE_HEIGHT_M &&
            segmentCrossesBox(a.x, a.z, b.x, b.z, box),
    );
}

/** The world-space step one strafe key produces, mirroring the movement
 * routine exactly (`step`, movement.ts): forward is -Z rotated by yaw,
 * right is +X rotated by yaw. Used to search for a clear stance before
 * ever pressing a key, rather than picking a direction and hoping. */
function strafeDelta(yaw: number, dir: "a" | "d"): { dx: number; dz: number } {
    const strafe = dir === "d" ? 1 : -1;
    return { dx: Math.cos(yaw) * strafe, dz: -Math.sin(yaw) * strafe };
}

const PROBE_STEP_M = 1;
const PROBE_MAX_M = 25;
const CLEAR_MARGIN_M = 1;

/** The shortest strafe, in either direction, that reaches a position
 * with a clear line of fire on the opponent - or null if none is found
 * within PROBE_MAX_M. Searching outward and taking the first hit in
 * either direction keeps the shooter as close to its current range as
 * the arena allows, which also keeps the aim tolerance in `aimOntoWire`
 * as loose as it can be (issue #19: tolerance tightens with range). */
function findClearStance(
    me: { x: number; z: number },
    them: { x: number; z: number },
    yaw: number,
    cover: CoverBoxState[],
): { dir: "a" | "d"; distance: number } | null {
    for (let d = PROBE_STEP_M; d <= PROBE_MAX_M; d += PROBE_STEP_M) {
        for (const dir of ["d", "a"] as const) {
            const delta = strafeDelta(yaw, dir);
            const probe = { x: me.x + delta.dx * d, z: me.z + delta.dz * d };
            if (hasLineOfFire(probe, them, cover)) {
                return { dir, distance: d + CLEAR_MARGIN_M };
            }
        }
    }
    return null;
}

/** Hold `dir` until `distanceM` of ground is covered or `timeoutMs`
 * elapses, whichever comes first: a wall just stalls the step, and
 * whatever the shooter actually reaches is what the next check reasons
 * about, not what this call intended. */
async function walk(
    page: Page,
    dir: "a" | "d" | "w" | "s",
    distanceM: number,
    timeoutMs: number,
): Promise<void> {
    const from = await positionOf(page);
    await page.keyboard.down(dir);
    try {
        const until = Date.now() + timeoutMs;
        while (Date.now() < until) {
            if (distanceFrom(from, await positionOf(page)) >= distanceM) break;
            await page.waitForTimeout(100);
        }
    } finally {
        await page.keyboard.up(dir);
    }
}

/** Wait for the predicted position to converge onto the server's before
 * firing: a burst is only worth taking once the origin the server will
 * raycast from is the one the barrel was aimed from (issue #8). Returns
 * once settled or when `timeoutMs` elapses, whichever comes first - a
 * slow settle is not fatal, since `aimOntoWire`'s own tolerance already
 * accounts for a shooter that has not perfectly converged. */
async function waitForSettle(page: Page, timeoutMs: number): Promise<void> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
        const drift = await page.evaluate(() => window.__sfDebug.correction());
        if (drift < DESYNC_SETTLED_M) return;
        await page.waitForTimeout(100);
    }
}

/** The lowest health the victim's own client has ever been told it had.
 *
 * The floor is recorded by the victim's client as snapshots arrive, not
 * sampled by the test. Polling across a process boundary cannot see a
 * hit reliably: damage lands, and three seconds later the respawn puts
 * health back to full, so a sampler that is slower than that reads an
 * untouched player and calls a working hit path broken. */
async function healthFloor(victim: Page): Promise<number> {
    const floor = await victim.evaluate(() => window.__sfDebug.minHealth());
    return typeof floor === "number" ? floor : 100;
}

/** One line describing where the shooter is, where it is pointing, and
 * whether its frame loop is running. Read on failure, not on success.
 *
 * `label` tags which phase of the attempt the sample was taken in
 * (issue #21): every previous sample here was taken before the trigger
 * was ever pulled, which can only prove the aim was right at that
 * instant - not what was actually on the wire while the trigger stayed
 * held, which is the one thing a failing run has never shown. */
async function describeAim(page: Page, attempt: number, label: string): Promise<string> {
    const state = await page.evaluate(() => {
        const me = window.__sfDebug.position();
        const them = window.__sfDebug.remotes()[0] ?? null;
        const sent = window.__sfDebug.sentFrames();
        const last = sent[sent.length - 1] ?? null;
        const word = window.__sfDebug.serverWord();
        return {
            me: { x: me.x, z: me.z },
            them: them ? { x: them.x, z: them.z } : null,
            yaw: window.__sfDebug.lookYaw(),
            wanted: them ? Math.atan2(-(them.x - me.x), -(them.z - me.z)) : null,
            locked: window.__sfDebug.locked(),
            frames: window.__sfDebug.framesRendered(),
            ammo: window.__sfDebug.ammo(),
            /* The wire and the server's adoption of it: what was
             * actually sent, and what the server says it adopted.
             * aim-off-by reads the controller; these read the two
             * things that can diverge from it (issue #8). */
            sent,
            last,
            word,
        };
    });
    const range = state.them
        ? Math.hypot(state.them.x - state.me.x, state.them.z - state.me.z)
        : NaN;
    // Normalised: yaw wraps, so a raw difference reports a turn of
    // 9 radians where the shooter is a degree off.
    let offBy = NaN;
    if (state.wanted !== null) {
        let d = (state.wanted - state.yaw) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        offBy = Math.abs(d);
    }
    return (
        `  #${attempt} [${label}] at (${state.me.x.toFixed(1)}, ${state.me.z.toFixed(1)})` +
        ` target ${state.them ? `(${state.them.x.toFixed(1)}, ${state.them.z.toFixed(1)})` : "unknown"}` +
        ` range ${range.toFixed(1)}m aim-off-by ${offBy.toFixed(3)}rad` +
        ` locked=${state.locked} frames=${state.frames} ammo=${state.ammo}` +
        wireLine(state)
    );
}

/* The wire state and the server's adoption of it, so a failure can say
 * which side the aim diverged on: what the controller held, what the
 * client sent, and what the server adopted are three facts, and the
 * first alone cannot convict the other two (issue #8). */
function wireLine(state: {
    sent: ReturnType<DebugSurface["sentFrames"]>;
    last: ReturnType<DebugSurface["sentFrames"]>[number] | null;
    word: ReturnType<DebugSurface["serverWord"]>;
}): string {
    const buttons = (f: { forward: boolean; back: boolean; left: boolean; right: boolean; fire: boolean } | null): string =>
        f
            ? [f.forward && "w", f.back && "s", f.left && "a", f.right && "d", f.fire && "f"]
                  .filter(Boolean)
                  .join("") || "-"
            : "-";
    // pitch and ack_tick ride on every real frame but were never shown
    // here before: pitch because it was assumed level, ack_tick because
    // nothing had yet named lag compensation a suspect (issue #21's
    // sequel - the yaw-corruption fix it enabled did not land the shot
    // either, so the two fields no one had looked at are the ones left).
    const wire = state.last
        ? `yaw ${state.last.yaw.toFixed(3)} pitch ${state.last.pitch.toFixed(3)}` +
          ` ack_tick ${state.last.ackTick} btn ${buttons(state.last)}`
        : "none";
    const server = state.word.position
        ? `yaw ${state.word.yaw.toFixed(3)} pitch ${state.word.pitch.toFixed(3)}` +
          ` pos (${state.word.position.x.toFixed(1)}, ${state.word.position.z.toFixed(1)}) ack ${state.word.ack}`
        : "none";
    const gap = state.last ? state.last.seq - state.word.ack : 0;
    return ` wire[${wire}] server[${server}] ack-gap ${gap}`;
}

/** Click the gate to take pointer lock, the way a player does.
 *
 * Returns whatever trace `levelPitch` gathered trying to correct pitch,
 * so a caller that cares (INT-004) can fold it into its own failure
 * output; every other caller can ignore it. */
async function capturePointer(page: Page): Promise<string[]> {
    const gate = page.locator("[data-gate]");
    await expect(gate).toBeVisible();
    await gate.click();
    await expect.poll(() => page.evaluate(() => window.__sfDebug.locked())).toBe(true);
    return levelPitch(page);
}

/** Best-effort: zero out pitch for a short window after taking pointer
 * lock, through the same synthetic input path aiming uses rather than a
 * real mouse action.
 *
 * `gate.click()` above is a real Playwright click, and on the CI runner
 * a corrupting side effect of that click - the same CDP/pointer-lock
 * mismatch issue #8 found in `page.mouse.down`/`up` (a real click
 * resolving against Chromium's own stale idea of where the cursor last
 * was) - has been observed landing on pitch here instead of yaw. It held
 * pitch at ~45 degrees for the rest of the match: invisible to every
 * other test, since none of them depend on fine vertical aim, but fatal
 * to INT-004's hitscan regardless of how accurate the yaw is.
 *
 * Three fixes already landed here and none of them stuck, and tracing
 * why named the actual shape of the problem (runs 31110883232,
 * 31112007362, 31113518915): the corruption does not land at any fixed
 * offset from the lock engaging - one run it showed up immediately and
 * survived fifteen correction attempts over 1.5s unchanged, another it
 * had not landed yet by the time this function's very first check ran
 * (which found a clean 0 and, in an earlier version of this function,
 * wrongly treated that as "done" and stopped watching). There is no
 * window early enough to reliably catch a corruption with no fixed
 * timing, so this no longer trusts one. It corrects whenever it happens
 * to see pitch off during its own short window, as cheap insurance for
 * every caller of `capturePointer`, but the window is not the real fix:
 * `aimAtOpponent` levels pitch on every call it makes for the rest of
 * the match, and it is the only thing INT-004 actually depends on. */
async function levelPitch(page: Page): Promise<string[]> {
    const trace: string[] = [];
    const until = Date.now() + 1_500;
    while (Date.now() < until) {
        const line = await page.evaluate(() => {
            const before = window.__sfDebug.lookPitch();
            if (Math.abs(before) < 1e-6) return null;
            // The controller applies pitch -= movementY * sensitivity.
            const sensitivity =
                Number(window.localStorage.getItem("sf_sensitivity")) || 0.0022;
            window.dispatchEvent(
                new MouseEvent("mousemove", {
                    movementX: 0,
                    movementY: before / sensitivity,
                }),
            );
            const after = window.__sfDebug.lookPitch();
            return `before=${before.toFixed(3)} after=${after.toFixed(3)}`;
        });
        // No early exit on a clean read: a clean read only means the
        // corruption has not landed YET, not that it never will:
        if (line !== null) trace.push(line);
        await page.waitForTimeout(100);
    }
    return trace;
}

test.describe("a match", () => {
    intent(
        "INT-002",
        "clicking_the_gate_captures_the_mouse_and_moving_it_turns_the_camera",
        async ({ browser }) => {
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host } = await startedMatch(browser, room);

            const before = await host.evaluate(() => window.__sfDebug.camera());
            await capturePointer(host);

            // Under pointer lock the browser reports relative deltas,
            // which is the only thing that can drive a first-person camera.
            await host.mouse.move(400, 300);
            await host.mouse.move(700, 380);

            await expect
                .poll(() =>
                    host.evaluate(
                        (start) => Math.abs(window.__sfDebug.camera().yaw - start),
                        before.yaw,
                    ),
                )
                .toBeGreaterThan(0.05);

            const after = await host.evaluate(() => window.__sfDebug.camera());
            expect(Math.abs(after.pitch)).toBeLessThanOrEqual(Math.PI / 2);
        },
    );

    intent(
        "INT-003",
        "holding_a_direction_travels_at_the_walk_speed_and_stops_on_release",
        async ({ browser }) => {
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host } = await startedMatch(browser, room);
            await capturePointer(host);

            const before = await host.evaluate(() => window.__sfDebug.position());
            await host.keyboard.down("w");

            // Wait for movement rather than for a stopwatch. A fixed
            // window is a bet that the frame loop ran during it, and on
            // a software-rendered runner a 600ms window can contain no
            // frames at all, which reads as "the player did not move".
            await expect
                .poll(
                    async () => distanceFrom(before, await positionOf(host)),
                    { timeout: 30_000 },
                )
                .toBeGreaterThan(0.5);

            // The upper bound is the claim worth keeping: the build this
            // replaced sent an unscaled per-frame constant as a
            // displacement and crossed the arena on one keypress. Walking
            // cannot outrun the walk speed over the wall clock, however
            // few or many frames the machine managed.
            const from = await positionOf(host);
            const startedAt = Date.now();
            await host.waitForTimeout(800);
            const to = await positionOf(host);
            const elapsed = (Date.now() - startedAt) / 1000;
            await host.keyboard.up("w");
            expect(distanceFrom(from, to)).toBeLessThan(MOVE_SPEED * elapsed * 1.5);

            // And it stops when the key comes up.
            const atRelease = await positionOf(host);
            await host.waitForTimeout(600);
            const afterRelease = await positionOf(host);
            expect(distanceFrom(atRelease, afterRelease)).toBeLessThan(0.35);
        },
    );

    intent(
        "INT-007",
        "a_player_cannot_walk_out_of_the_arena",
        async ({ browser }) => {
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host } = await startedMatch(browser, room);
            await capturePointer(host);

            expect(
                await host.evaluate(() => window.__sfDebug.coverCount()),
            ).toBeGreaterThan(0);

            // The arena the server actually sent, so redrawing the map
            // does not silently turn this into an assertion about
            // nothing. Only the bounds are read: where the walls are is
            // the server's to say, staying inside them is the claim.
            const bounds = await host.evaluate(() => window.__sfDebug.bounds());
            expect(bounds).not.toBeNull();

            // Long enough to cross the arena several times over.
            await host.keyboard.down("w");
            await host.waitForTimeout(6000);
            await host.keyboard.up("w");

            const position = await host.evaluate(() => window.__sfDebug.position());
            expect(position.x).toBeGreaterThanOrEqual(bounds!.min.x);
            expect(position.x).toBeLessThanOrEqual(bounds!.max.x);
            expect(position.z).toBeGreaterThanOrEqual(bounds!.min.z);
            expect(position.z).toBeLessThanOrEqual(bounds!.max.z);
        },
    );

    intent(
        "INT-004",
        "firing_at_an_opponent_takes_their_hit_points_down",
        async ({ browser }) => {
            // Up to a dozen approach attempts, each with a burst and a
            // walk, on a runner that may render a few frames a second.
            test.setTimeout(300_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host, guest } = await startedMatch(browser, room);
            const pitchTrace = await capturePointer(host);

            const guestHp = guest.locator("[data-health-number]");
            await expect(guestHp).toHaveText("100");

            /* Play toward a shot rather than assuming one exists from
             * the spawn. Cover between two spawn points is the map doing
             * its job, so a blocked line is not a failure: aim, fire, and
             * if nothing lands, close the distance the way a player would.
             * That keeps this a test of whether hits register, not a test
             * of one arena's geometry.
             *
             * Every step waits on a condition rather than a stopwatch,
             * because a software-rendered runner can pass a whole
             * wall-clock window without rendering a frame. */
            await expect
                .poll(() => host.evaluate(() => window.__sfDebug.remoteCount()))
                .toBeGreaterThan(0);

            let lowest = 100;
            // Kept so a failure can say what the shooter was doing.
            // "It did not hit" is not a diagnosis, and this runs on
            // machines far slower than the one it was written on.
            const telemetry: string[] = [];
            if (pitchTrace.length > 0) {
                telemetry.push(`  pitch-correct-trace: ${pitchTrace.join(" | ")}`);
            }

            // The room's own cover, not a copy of one: fetched once
            // because it does not change mid-match, and used to decide
            // where a shot can land instead of guessing (issue #20).
            const cover = await host.evaluate(() => window.__sfDebug.cover());

            /* Each attempt either moves or fires, never both: a blocked
             * line gets a computed stance and re-probes fresh from
             * wherever the shooter actually ends up (a wall may have
             * stalled the step short of the plan), and only a clear line
             * gets the settle-aim-fire sequence issue #8 needs. That
             * replaces the previous approach's blind alternating sweep,
             * which reasoned about a single block from the spawn point
             * and never re-checked that reasoning against where the
             * strafing actually went - it drifted into the arena's
             * corner instead (issue #20).
             *
             * A shot fired WHILE strafing does not land even once the
             * sightline is open: the server raycasts from its own
             * authoritative position for the shooter, and on a runner
             * taking a big step per frame that trails the client's
             * predicted position by a stride - a metre or two of origin
             * error thrown across dozens of metres misses the target
             * entirely. So every stance stops, settles, and only then
             * aims and fires. Every wait is on a condition polled from
             * the frame loop, never a stopwatch: a software-rendered
             * runner can pass a wall-clock window without rendering a
             * frame. */
            for (let attempt = 0; attempt < 10 && lowest === 100; attempt++) {
                await aimAtOpponent(host);
                const yaw = await host.evaluate(() => window.__sfDebug.lookYaw());
                const me = await positionOf(host);
                const them = await host.evaluate(() => {
                    const remote = window.__sfDebug.remotes()[0];
                    return remote ? { x: remote.x, z: remote.z } : null;
                });
                if (!them) continue;

                if (!hasLineOfFire(me, them, cover)) {
                    const stance = findClearStance(me, them, yaw, cover);
                    if (stance) {
                        await walk(host, stance.dir, stance.distance, 6_000);
                    } else {
                        // No computed stance clears within range: close
                        // the distance instead, the way a player pinned
                        // behind cover would, and let the next attempt
                        // re-probe from there.
                        await walk(host, "w", 3, 4_000);
                    }
                    continue;
                }

                // The line is clear. Let the predicted position converge
                // onto the server's before firing, so the barrel and the
                // server's origin agree (issue #8).
                await waitForSettle(host, 6_000);

                // Drive the SENT yaw onto the opponent before firing, not
                // just the held one. aim-off-by reads the yaw the
                // controller holds; the server raycasts from the yaw the
                // client last put on the wire, and on a runner rendering
                // a frame every few hundred ms that trails the held aim
                // by a wide margin - the wire showed ~80 degrees of lag
                // while aim-off-by read zero (issue #8), so every burst
                // flew wide. Wait until the wire itself points at the
                // opponent within the hit cylinder's own tolerance
                // (issue #19), then the trigger is pulled only once the
                // server has the aim the barrel is on.
                const onTarget = await aimOntoWire(host, 4_000);
                if (telemetry.length < 32) {
                    telemetry.push(await describeAim(host, telemetry.length, "pre-fire"));
                }
                if (!onTarget) continue;

                await setTrigger(host, true);
                try {
                    const fireUntil = Date.now() + 2_500;
                    // Sample the wire while the trigger stays held, not
                    // just before it is pulled (issue #21): roughly every
                    // 600ms, so a failing run shows whether `fire` ever
                    // actually reached the wire and what yaw it carried
                    // while it did, instead of only what the controller
                    // held a moment before the trigger was pulled.
                    let nextSample = Date.now();
                    while (Date.now() < fireUntil && lowest === 100) {
                        lowest = Math.min(lowest, await healthFloor(guest));
                        if (Date.now() >= nextSample && telemetry.length < 32) {
                            telemetry.push(await describeAim(host, telemetry.length, "firing"));
                            nextSample = Date.now() + 600;
                        }
                        await host.waitForTimeout(100);
                    }
                } finally {
                    await setTrigger(host, false);
                    if (telemetry.length < 32) {
                        telemetry.push(await describeAim(host, telemetry.length, "after-release"));
                    }
                }
            }

            // The server raycast it, so the drop shows on the victim's
            // own client and not merely on the shooter's.
            expect(
                lowest,
                ["no shot landed:", ...telemetry].join("\n"),
            ).toBeLessThan(100);
        },
    );

    intent(
        "INT-009",
        "the_local_prediction_stays_in_step_with_the_server",
        async ({ browser }) => {
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host } = await startedMatch(browser, room);
            await capturePointer(host);

            await host.keyboard.down("w");
            await host.waitForTimeout(1500);
            await host.keyboard.up("w");
            await host.waitForTimeout(400);

            // Prediction and the authoritative simulation run the same
            // routine, so on a local connection the correction each
            // snapshot applies should be nearly nothing. A large value
            // means the two have drifted apart.
            const correction = await host.evaluate(() =>
                window.__sfDebug.correction(),
            );
            expect(correction).toBeLessThan(0.5);
        },
    );

    intent(
        "INT-014",
        "the_host_picks_the_arena_and_every_screen_in_the_room_rebuilds_on_it",
        async ({ browser, request }) => {
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host, guest } = await lobby(browser, room);

            /* The picker offers what the server offers. Reading the
             * catalogue from the API rather than naming the arenas here
             * is the point: a client list of maps is a list that can
             * disagree with the server about which maps exist. */
            const catalogue = (await (await request.get("/api/arenas")).json()) as {
                id: string;
                name: string;
            }[];
            expect(catalogue.length).toBeGreaterThan(1);
            for (const arena of catalogue) {
                const option = host.locator(`[data-arena="${arena.id}"]`);
                await expect(option).toBeVisible();
                await expect(option).toContainText(arena.name);
            }

            const current = await host
                .locator('[data-arena][data-selected="true"]')
                .getAttribute("data-arena");
            const wanted = catalogue.find((arena) => arena.id !== current)!.id;

            await host.locator(`[data-arena="${wanted}"]`).click();

            /* The choice is the server's to make, so the proof it landed
             * is the other player's screen changing: the guest is told
             * nothing by the click itself. */
            await expect(
                guest.locator(`[data-arena="${wanted}"]`),
            ).toHaveAttribute("data-selected", "true");

            /* The layout travels with the choice, so both scenes are
             * rebuilt on it rather than relabelled. This reads the arena
             * the meshes were built from, not the one the snapshot
             * named. */
            for (const page of [host, guest]) {
                await expect
                    .poll(() => page.evaluate(() => window.__sfDebug.sceneArenaId()))
                    .toBe(wanted);
                expect(
                    await page.evaluate(() => window.__sfDebug.coverCount()),
                ).toBeGreaterThan(0);
            }
        },
    );
});
