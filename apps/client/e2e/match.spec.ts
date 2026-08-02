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
    correction(): number;
    locked(): boolean;
    remoteCount(): number;
    remotes(): { id: string; x: number; y: number; z: number; visible: boolean }[];
    coverCount(): number;
    sceneArenaId(): string;
    bounds(): { min: Vec3; max: Vec3 } | null;
    state(): string | null;
    localId(): string;
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

async function joinRoom(browser: Browser, room: string, name: string): Promise<Page> {
    const context = await browser.newContext();
    opened.push(context);
    await context.addInitScript(
        ([playerName]) => window.localStorage.setItem("sf_player_name", playerName),
        [name],
    );
    const page = await context.newPage();
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
            await host.waitForTimeout(600);
            await host.keyboard.up("w");
            const afterWalk = await host.evaluate(() => window.__sfDebug.position());

            const travelled = Math.hypot(
                afterWalk.x - before.x,
                afterWalk.z - before.z,
            );
            // The old build accumulated an unscaled constant per frame and
            // sent it as a displacement, so one keypress crossed the arena.
            // Half a second of walking is metres, not tens of metres.
            expect(travelled).toBeGreaterThan(0.5);
            expect(travelled).toBeLessThan(MOVE_SPEED * 1.5);

            await host.waitForTimeout(400);
            const afterRelease = await host.evaluate(() =>
                window.__sfDebug.position(),
            );
            expect(
                Math.hypot(
                    afterRelease.x - afterWalk.x,
                    afterRelease.z - afterWalk.z,
                ),
            ).toBeLessThan(0.35);
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
            test.setTimeout(120_000);
            const room = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
            const { host, guest } = await startedMatch(browser, room);
            await capturePointer(host);

            const guestHp = guest.locator("[data-health-number]");
            await expect(guestHp).toHaveText("100");

            // The two spawn on opposite corners and the arena's centre
            // pillar stands on the line between them, so step off that
            // line first or every shot is legitimately blocked.
            //
            // Strafe until the distance is achieved rather than for a
            // fixed time: a backgrounded page has its frame loop
            // throttled, so a wall-clock walk covers an unpredictable
            // distance.
            const origin = await host.evaluate(() => window.__sfDebug.position());
            await host.keyboard.down("d");
            await expect
                .poll(
                    async () =>
                        Math.abs(
                            (await host.evaluate(() => window.__sfDebug.position()))
                                .x - origin.x,
                        ),
                    { timeout: 30_000 },
                )
                .toBeGreaterThan(6);
            await host.keyboard.up("d");
            await host.waitForTimeout(200);

            await expect
                .poll(() => host.evaluate(() => window.__sfDebug.remoteCount()))
                .toBeGreaterThan(0);

            // Aim at the opponent rather than sweeping past them: at
            // fifty metres a player subtends about a degree, so a coarse
            // sweep steps over the target between samples and proves
            // nothing about whether hits register.
            await host.evaluate(() => {
                const me = window.__sfDebug.position();
                const them = window.__sfDebug.remotes()[0];
                const dx = them.x - me.x;
                const dz = them.z - me.z;
                // Forward is (-sin(yaw), 0, -cos(yaw)), so the yaw that
                // points at (dx, dz) is atan2(-dx, -dz).
                const wanted = Math.atan2(-dx, -dz);
                const current = window.__sfDebug.camera().yaw;
                let delta = (wanted - current) % (Math.PI * 2);
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
            await host.waitForTimeout(200);

            /* Hold the trigger and watch the victim's own screen while
             * it is held. The server rate-limits, so this is a burst
             * rather than one shot, and it survives a near miss.
             *
             * The reading has to be taken during the burst, not after
             * it: this is a 1v1, the first kill leaves one man standing
             * and ends the match, and the victim comes back on full
             * health. Sampling once the trigger is released races that.
             *
             * The assertion is on the lowest reading seen, so a sample
             * that lands after a respawn cannot un-see the hit. */
            let lowest = 100;
            await host.mouse.down();
            try {
                await expect
                    .poll(
                        async () => {
                            const shown = Number(await guestHp.textContent());
                            if (Number.isFinite(shown)) {
                                lowest = Math.min(lowest, shown);
                            }
                            return lowest;
                        },
                        { timeout: 20_000 },
                    )
                    .toBeLessThan(100);
            } finally {
                await host.mouse.up();
            }
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
