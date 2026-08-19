/* The Arsenal view (ARS-001/002/003, issue #41), played from the menu.

Drives the real client against the real backend. Pins INT-026 (the
arsenal tile is functional and opens the view), INT-027 (the view renders
the player model with its placeholder note), and INT-028 (the inventory
renders gracefully empty, bound to the ARS-004 envelope).
*/
import { expect, test, type Browser } from "@playwright/test";

import { intent } from "./intent-shim";

async function openMenu(browser: Browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.locator('[data-launch="guest"]').click();
    await expect(page.locator("[data-account-panel]")).toBeVisible();
    return { context, page };
}

intent(
    "INT-026",
    "the arsenal tile opens the arsenal view",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser);

        // The tile is functional, not a disabled placeholder.
        const tile = page.locator('[data-tile="arsenal"]');
        await expect(tile).toBeEnabled();
        await expect(tile).toHaveAttribute("data-tile-status", "ready");

        await tile.click();
        await expect(page.locator("[data-arsenal-inventory]")).toBeVisible();
        await expect(page.locator("[data-menu-back]")).toBeVisible();

        // The view is not a dead end: its back button returns to the menu.
        await page.locator("[data-menu-back]").click();
        await expect(page.locator('[data-tile="versus"]')).toBeVisible();

        await context.close();
    },
);

intent(
    "INT-027",
    "the arsenal view renders the player model",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser);

        await page.locator('[data-tile="arsenal"]').click();
        await expect(page.locator("[data-arsenal-model]")).toBeVisible();
        // The rig actually rendered (WebGL came up), not merely the shell.
        await expect
            .poll(() =>
                page
                    .locator("[data-arsenal-model]")
                    .getAttribute("data-arsenal-model-rendered"),
            )
            .toBe("true");
        // The 3D viewer is a later line; the panel clearly says so.
        await expect(page.locator("[data-arsenal-model-placeholder]")).toBeVisible();

        await context.close();
    },
);

intent(
    "INT-028",
    "the arsenal inventory renders gracefully empty",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser);

        await page.locator('[data-tile="arsenal"]').click();
        await expect(page.locator("[data-arsenal-inventory]")).toBeVisible();
        // A guest holds nothing: a legible empty state, not a broken panel.
        await expect(page.locator("[data-arsenal-empty]")).toBeVisible();
        await expect(page.locator("[data-arsenal-shop]")).toBeVisible();

        await context.close();
    },
);
