/* The mobile shooting layout, mounted and driven (issue #17, INT-018).
 *
 * The touch channel's two pure decisions - which devices get the overlay,
 * and how a stick vector becomes the four held booleans - are already
 * unit-tested (`src/input/touch.test.ts`). What that leaves unattested is
 * the live overlay's DOM plumbing: `TouchControls.tsx` wiring each on-screen
 * control to the same `InputController` intent the keyboard and mouse feed.
 * The desktop match specs (`match.spec.ts`) run under a project with no
 * coarse pointer, so `MatchPage` never mounts the overlay there and that
 * plumbing is invisible to CI - which is why INT-018 stood `draft`.
 *
 * This spec runs under the `touch` project (`playwright.config.ts`), which
 * emulates a phone: a coarse primary pointer AND a touch point, the pair
 * `isTouchDevice()` (`src/input/touch.ts`) gates the overlay on. So
 * `MatchPage` mounts `TouchControls` in place of the pointer-lock gate, and
 * this drives the thumbstick, the look pad and the fire button, asserting
 * each puts the same intent on the wire (a held direction, a turned yaw, a
 * pulled trigger) a desktop match puts there through the mouse and keyboard.
 * Carrying the `INT-018` marker is what promotes the claim to `active`.
 *
 * The controls are driven with `page.mouse`, not `page.touchscreen`:
 * touchscreen only taps, and the stick, the look pad and a held fire button
 * each need a sustained, dragged pointer. Every one of the overlay's
 * handlers is `onPointerDown/Move/Up` and pointer-type-agnostic, so a real
 * mouse pointer exercises the identical plumbing a finger's pointer events
 * do - and it must be a *real* pointer, since a dispatched one cannot back
 * the `setPointerCapture` each control makes. The InputController's own mouse
 * listeners stay inert throughout, because they are all gated on a pointer
 * lock a touch device never takes: the emulated device is what mounts the
 * overlay, the pointer is only how the mounted overlay is driven.
 */
import {
    devices,
    expect,
    test,
    type BrowserContext,
    type Page,
} from "@playwright/test";

import { intent } from "./intent-shim";

/* The slices of the debug surface this spec reads, cast inline at each read
 * rather than augmenting `Window.__sfDebug` the way `match.spec.ts` does:
 * two global augmentations of the same property with different shapes
 * collide under `tsc`, so this file keeps its narrower view local. */
const state = (page: Page) =>
    page.evaluate(
        () =>
            (window as unknown as { __sfDebug: { state(): string | null } })
                .__sfDebug.state(),
    );

const position = (page: Page) =>
    page.evaluate(() => {
        const p = (
            window as unknown as {
                __sfDebug: { position(): { x: number; y: number; z: number } };
            }
        ).__sfDebug.position();
        return { x: p.x, z: p.z };
    });

/** The last input frame this client actually put on the wire - the same
 * server-bound intent `match.spec.ts` asserts on for the desktop path. */
const lastFrame = (page: Page) =>
    page.evaluate(() => {
        const frames = (
            window as unknown as {
                __sfDebug: {
                    sentFrames(): { forward: boolean; fire: boolean; yaw: number }[];
                };
            }
        ).__sfDebug.sentFrames();
        return frames[frames.length - 1] ?? null;
    });

function distance(
    a: { x: number; z: number },
    b: { x: number; z: number },
): number {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

/* A phone context for the second player, matching the `touch` project's own
 * emulation so both players are the same kind of device. */
const PHONE = devices["Pixel 5"];

/* Manually-opened contexts (the second player), closed after each test so a
 * leaked page does not keep rendering WebGL on the one worker this suite
 * runs. The player under test rides the fixture `page`, which Playwright
 * closes itself. */
const opened: BrowserContext[] = [];

test.afterEach(async () => {
    await Promise.all(opened.splice(0).map((context) => context.close()));
});

async function join(
    context: BrowserContext,
    room: string,
    name: string,
): Promise<Page> {
    await context.addInitScript(
        (playerName) => window.localStorage.setItem("sf_player_name", playerName),
        name,
    );
    const page = await context.newPage();
    await page.goto(`/#/${room}`);
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    return page;
}

/** Press and hold a control at its centre, run `hold`, then release. The
 * control captures the pointer on down, so a drag that leaves its box keeps
 * driving it - exactly what a thumb sliding off the stick does. */
async function pressHold(
    page: Page,
    selector: string,
    hold: (centre: { x: number; y: number }) => Promise<void>,
): Promise<void> {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`no bounding box for ${selector}`);
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    try {
        await hold(centre);
    } finally {
        await page.mouse.up();
    }
}

test.describe("the touch overlay", () => {
    intent(
        "INT-018",
        "the_on_screen_stick_look_pad_and_fire_button_feed_the_same_intent_as_mouse_and_keyboard",
        async ({ page: host, context, browser }) => {
            test.setTimeout(120_000);
            const room = `T32${Date.now().toString(36).slice(-5).toUpperCase()}`;

            // The player under test is the fixture page: it rides the `touch`
            // project's phone emulation, so `isTouchDevice()` is true and
            // `MatchPage` mounts the overlay. The init script lands on its
            // upcoming navigation, so the name is set before the app reads it.
            await context.addInitScript(
                (name) => window.localStorage.setItem("sf_player_name", name),
                "e2e-touch-host",
            );
            await host.goto(`/#/${room}`);
            await expect(host.locator('#app[data-scene-ready="true"]')).toBeAttached();

            const guestContext = await browser.newContext({ ...PHONE });
            opened.push(guestContext);
            const guest = await join(guestContext, room, "e2e-touch-guest");

            // Ready both, then the host (first to join) starts the match.
            await expect(host.locator("[data-ready]")).toBeVisible();
            await expect(guest.locator("[data-ready]")).toBeVisible();
            await host.locator("[data-ready]").click();
            await guest.locator("[data-ready]").click();
            const start = host.locator("[data-start]");
            await expect(start).toBeEnabled();
            await start.click();
            await expect.poll(() => state(host)).toBe("playing");

            // The device fork chose touch: the overlay stands where the
            // desktop pointer-lock gate would (INT-018's own claim; the
            // desktop pointer-lock layout, INT-002, is untouched).
            await expect(host.locator("[data-touch-controls]")).toBeVisible();
            await expect(host.locator("[data-gate]")).toHaveCount(0);

            // A frame is on the wire before anything is read off it.
            await expect
                .poll(async () => (await lastFrame(host)) !== null)
                .toBe(true);

            // Aim: dragging the look pad turns the yaw the client sends, the
            // same field a mouse turns under lock (INT-002).
            const beforeYaw = (await lastFrame(host))!.yaw;
            await pressHold(host, "[data-touch-look]", async (centre) => {
                await host.mouse.move(centre.x + 90, centre.y, { steps: 5 });
            });
            await expect
                .poll(async () =>
                    Math.abs(((await lastFrame(host))?.yaw ?? beforeYaw) - beforeYaw),
                )
                .toBeGreaterThan(0.05);

            // Walk: pushing the stick forward holds the forward direction on
            // the wire and travels, the same intent W feeds (INT-003). The
            // pointer stays down across the poll, so the direction stays held.
            const origin = await position(host);
            await pressHold(host, "[data-touch-stick]", async (centre) => {
                await host.mouse.move(centre.x, centre.y - 46, { steps: 5 });
                await expect
                    .poll(async () => (await lastFrame(host))?.forward ?? false)
                    .toBe(true);
                await expect
                    .poll(
                        async () => distance(origin, await position(host)),
                        { timeout: 30_000 },
                    )
                    .toBeGreaterThan(0.5);
            });
            // Lifting the thumb drops the direction: no key is left held down.
            await expect
                .poll(async () => (await lastFrame(host))?.forward ?? true)
                .toBe(false);

            // Fire: holding the fire button pulls the trigger on the wire, the
            // same firing bit a mouse button sets under lock (INT-004).
            await pressHold(host, "[data-touch-fire]", async () => {
                await expect
                    .poll(async () => (await lastFrame(host))?.fire ?? false)
                    .toBe(true);
            });
            await expect
                .poll(async () => (await lastFrame(host))?.fire ?? true)
                .toBe(false);
        },
    );
});
