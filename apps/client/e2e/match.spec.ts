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

interface DebugSurface {
    camera(): { yaw: number; pitch: number };
    position(): { x: number; y: number; z: number };
    eyeHeight(): number;
    correction(): number;
    locked(): boolean;
    remoteCount(): number;
    remotes(): { id: string; x: number; y: number; z: number; visible: boolean }[];
    coverCount(): number;
    sceneArenaId(): string;
    bounds(): { min: Vec3; max: Vec3 } | null;
    state(): string | null;
    localId(): string;
    health(): number | null;
    minHealth(): number | null;
    framesRendered(): number;
    lookYaw(): number;
    ammo(): number | null;
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
 * relative-motion event the browser delivers under lock. */
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
        // The controller applies yaw -= movementX * sensitivity.
        const sensitivity =
            Number(window.localStorage.getItem("sf_sensitivity")) || 0.0022;
        window.dispatchEvent(
            new MouseEvent("mousemove", {
                movementX: -delta / sensitivity,
                movementY: 0,
            }),
        );
    });
}

/** Hold the trigger for `ms`, then report the lowest health the victim's
 * own client has ever been told it had.
 *
 * The floor is recorded by the victim's client as snapshots arrive, not
 * sampled by the test. Polling across a process boundary cannot see a
 * hit reliably: damage lands, and three seconds later the respawn puts
 * health back to full, so a sampler that is slower than that reads an
 * untouched player and calls a working hit path broken. */
async function burstAndWatch(shooter: Page, victim: Page, ms: number): Promise<number> {
    await shooter.mouse.down();
    try {
        await shooter.waitForTimeout(ms);
    } finally {
        await shooter.mouse.up();
    }
    const floor = await victim.evaluate(() => window.__sfDebug.minHealth());
    return typeof floor === "number" ? floor : 100;
}

/** Metres between the shooter and the opponent it can see. */
async function rangeToOpponent(page: Page): Promise<number> {
    return page.evaluate(() => {
        const me = window.__sfDebug.position();
        const them = window.__sfDebug.remotes()[0];
        if (!them) return Number.POSITIVE_INFINITY;
        return Math.hypot(them.x - me.x, them.z - me.z);
    });
}

/** One line describing where the shooter is, where it is pointing, and
 * whether its frame loop is running. Read on failure, not on success. */
async function describeAim(page: Page, attempt: number): Promise<string> {
    const state = await page.evaluate(() => {
        const me = window.__sfDebug.position();
        const them = window.__sfDebug.remotes()[0] ?? null;
        return {
            me: { x: me.x, z: me.z },
            them: them ? { x: them.x, z: them.z } : null,
            yaw: window.__sfDebug.lookYaw(),
            wanted: them ? Math.atan2(-(them.x - me.x), -(them.z - me.z)) : null,
            locked: window.__sfDebug.locked(),
            frames: window.__sfDebug.framesRendered(),
            ammo: window.__sfDebug.ammo(),
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
        `  #${attempt} at (${state.me.x.toFixed(1)}, ${state.me.z.toFixed(1)})` +
        ` target ${state.them ? `(${state.them.x.toFixed(1)}, ${state.them.z.toFixed(1)})` : "unknown"}` +
        ` range ${range.toFixed(1)}m aim-off-by ${offBy.toFixed(3)}rad` +
        ` locked=${state.locked} frames=${state.frames} ammo=${state.ammo}`
    );
}

/* Hold `key` until `metres` have been covered, or give up.
 *
 * Returns whether the distance was made. Walking into a wall stalls
 * rather than fails: the arena is allowed to have walls in it, and a
 * caller that wants to get somewhere needs to know it was blocked so it
 * can try another way. */
async function advance(
    page: Page,
    key: string,
    metres: number,
    timeoutMs: number,
): Promise<boolean> {
    const from = await positionOf(page);
    await page.keyboard.down(key);
    try {
        const until = Date.now() + timeoutMs;
        while (Date.now() < until) {
            if (distanceFrom(from, await positionOf(page)) >= metres) return true;
            await page.waitForTimeout(150);
        }
        return false;
    } finally {
        await page.keyboard.up(key);
    }
}

/** Click the gate to take pointer lock, the way a player does. */
async function capturePointer(page: Page): Promise<void> {
    const gate = page.locator("[data-gate]");
    await expect(gate).toBeVisible();
    await gate.click();
    await expect.poll(() => page.evaluate(() => window.__sfDebug.locked())).toBe(true);
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

            // Jump (issue #10). Holding Space bounces a grounded player off
            // the floor, so the feet rise above the ground; the arc is
            // predicted, so it shows without waiting for the server. Poll
            // for the rise rather than time it: on a software renderer the
            // frames are sparse, but a held jump re-fires every time it
            // lands, so one will be caught in the air.
            await host.keyboard.down("Space");
            await expect
                .poll(async () => (await positionOf(host)).y, { timeout: 30_000 })
                .toBeGreaterThan(0.2);
            // Releasing it, the player settles back onto the ground.
            await host.keyboard.up("Space");
            await expect
                .poll(async () => (await positionOf(host)).y, { timeout: 30_000 })
                .toBeLessThan(0.05);

            // Crouch (issue #10). Holding the crouch key drops the eye well
            // below standing height; releasing it raises the eye back. The
            // eye height is read off the real camera rig, not a constant.
            const standingEye = await host.evaluate(() =>
                window.__sfDebug.eyeHeight(),
            );
            expect(standingEye).toBeGreaterThan(1.4);
            await host.keyboard.down("c");
            await expect
                .poll(async () => host.evaluate(() => window.__sfDebug.eyeHeight()), {
                    timeout: 30_000,
                })
                .toBeLessThan(standingEye - 0.3);
            await host.keyboard.up("c");
            await expect
                .poll(async () => host.evaluate(() => window.__sfDebug.eyeHeight()), {
                    timeout: 30_000,
                })
                .toBeGreaterThan(standingEye - 0.05);
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
            await capturePointer(host);

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
            let sidestep: "a" | "d" = "d";

            for (let approach = 0; approach < 12 && lowest === 100; approach++) {
                await aimAtOpponent(host);
                telemetry.push(await describeAim(host, approach));
                lowest = await burstAndWatch(host, guest, 1_500);
                if (lowest < 100) break;

                /* Nothing landed, so cover is in the way. Close in, and
                 * judge that by the RANGE to the opponent rather than by
                 * ground covered: walking into a wall slides along it,
                 * which covers plenty of ground while getting no nearer,
                 * and a shooter that mistakes the two grinds into a
                 * corner. When the range stops falling, sidestep to look
                 * for the way around, alternating sides so a wall cannot
                 * pin it against the same edge twice. */
                const rangeBefore = await rangeToOpponent(host);
                await advance(host, "w", 3, 5_000);
                const rangeAfter = await rangeToOpponent(host);
                if (!(rangeAfter < rangeBefore - 1)) {
                    await advance(host, sidestep, 4, 5_000);
                    sidestep = sidestep === "d" ? "a" : "d";
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
