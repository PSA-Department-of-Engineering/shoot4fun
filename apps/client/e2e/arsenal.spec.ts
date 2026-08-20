/* The Arsenal view (issue #41).
 *
 * Drives the real app against a real server. The Arsenal tile is now
 * functional (INT-026), the view renders the player-model panel (INT-027),
 * and the inventory/loadout section renders gracefully empty, bound to the
 * forward-compatible Arsenal data shape (INT-028).
 */
import { expect, test, type Browser } from "@playwright/test";

import { intent } from "./intent-shim";

/** Land on the main menu as a guest. */
async function toMenu(browser: Browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.locator('[data-launch="guest"]').click();
    await expect(page.locator('[data-account-panel]')).toBeVisible();
    return page;
}

test.describe("arsenal", () => {
    intent(
        "INT-026",
        "the_arsenal_tile_is_functional_and_opens_the_view",
        async ({ browser }) => {
            const page = await toMenu(browser);
            const tile = page.locator('[data-tile="arsenal"]');
            // The tile is ready, not a disabled placeholder.
            await expect(tile).toBeEnabled();
            await expect(tile).toHaveAttribute('data-tile-status', 'ready');
            await tile.click();
            // Selecting it opens the Arsenal view.
            await expect(page.locator('[data-arsenal-view]')).toBeVisible();
            // And it returns to the menu.
            await page.locator('[data-arsenal-back]').click();
            await expect(page.locator('[data-tile="arsenal"]')).toBeVisible();
        },
    );

    intent(
        "INT-027",
        "the_arsenal_view_renders_the_player_model_panel",
        async ({ browser }) => {
            const page = await toMenu(browser);
            await page.locator('[data-tile="arsenal"]').click();
            await expect(page.locator('[data-arsenal-view]')).toBeVisible();
            // The operator/model panel is present, clearly a placeholder until
            // the 3D viewer lands.
            await expect(page.locator('[data-arsenal-model]')).toBeVisible();
            await expect(page.locator('[data-arsenal-model-name]')).toHaveText(
                'robot',
            );
        },
    );

    intent(
        "INT-028",
        "the_arsenal_inventory_renders_gracefully_empty",
        async ({ browser }) => {
            const page = await toMenu(browser);
            await page.locator('[data-tile="arsenal"]').click();
            await expect(page.locator('[data-arsenal-inventory]')).toBeVisible();
            // Empty first: a legible "nothing yet" state and a (disabled) shop
            // affordance, never a broken panel.
            await expect(page.locator('[data-arsenal-empty]')).toBeVisible();
            await expect(page.locator('[data-arsenal-shop]')).toBeVisible();
            await expect(page.locator('[data-arsenal-list]')).toHaveCount(0);
        },
    );
});
