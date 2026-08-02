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
import { expect, test, type Browser, type Page } from "@playwright/test";

import { intent } from "./intent-shim";

interface DebugSurface {
    camera(): { yaw: number; pitch: number };
    position(): { x: number; y: number; z: number };
    correction(): number;
    locked(): boolean;
    remoteCount(): number;
    remotes(): { id: string; x: number; y: number; z: number; visible: boolean }[];
    coverCount(): number;
    state(): string | null;
    localId(): string;
}

declare global {
    interface Window {
        __sfDebug: DebugSurface;
    }
}

const MOVE_SPEED = 6.0;

async function joinRoom(browser: Browser, room: string, name: string): Promise<Page> {
    const context = await browser.newContext();
    await context.addInitScript(
        ([playerName]) => window.localStorage.setItem("sf_player_name", playerName),
        [name],
    );
    const page = await context.newPage();
    await page.goto(`/#/${room}`);
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    return page;
}

/** Two players in one room, readied up, with the match running. */
async function startedMatch(
    browser: Browser,
    room: string,
): Promise<{ host: Page; guest: Page }> {
    const host = await joinRoom(browser, room, "e2e-host");
    const guest = await joinRoom(browser, room, "e2e-guest");

    await expect(host.locator("[data-ready]")).toBeVisible();
    await expect(guest.locator("[data-ready]")).toBeVisible();
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
            await host.context().close();
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
            await host.context().close();
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

            // Long enough to cross the arena several times over.
            await host.keyboard.down("w");
            await host.waitForTimeout(6000);
            await host.keyboard.up("w");

            const position = await host.evaluate(() => window.__sfDebug.position());
            expect(Math.abs(position.x)).toBeLessThanOrEqual(30);
            expect(Math.abs(position.z)).toBeLessThanOrEqual(30);
            await host.context().close();
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

            // Hold the trigger: the server rate-limits, so this is a
            // burst rather than one shot, and it survives a near miss.
            await host.mouse.down();
            await host.waitForTimeout(2000);
            await host.mouse.up();

            // The server raycasts and applies the damage, so the drop
            // shows on the victim's own screen, not just the shooter's.
            await expect
                .poll(async () => Number(await guestHp.textContent()), {
                    timeout: 20_000,
                })
                .toBeLessThan(100);

            await host.context().close();
            await guest.context().close();
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
            await host.context().close();
        },
    );
});
