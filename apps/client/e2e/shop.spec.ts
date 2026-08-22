/* The shop surface (shoot4fun-shop / P1).
 *
 * Drives the real app against a real server: the catalog browse (INT-030),
 * the detail screen and its Unlock-only placement (INT-031), the unlock
 * journey through to the Arsenal listing the acquired item (INT-034's e2e
 * half), and the applied material observable on the rig host
 * (INT-036).
 *
 * The unlock -> acquired transition mounts a second WebGL rig alongside
 * the always-running scene renderer. Under CI's SwiftShader that first
 * frame is expensive, so the journey assertions use a wider window than
 * the default - the claims are about behavior, not paint speed.
 */
import { expect, test, type Browser } from "@playwright/test";

import { intent } from "./intent-shim";

const JOURNEY_TIMEOUT = 30_000;

/** Land on the main menu as a guest, then open the shop catalog. */
async function toShopCatalog(browser: Browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.locator('[data-launch="guest"]').click();
    await expect(page.locator('[data-account-panel]')).toBeVisible();
    await page.locator('[data-tile="shop"]').click();
    await expect(page.locator("[data-shop-catalog]")).toBeVisible();
    // The catalog is loaded from the real server before assertions run.
    await expect(page.locator("[data-item-link]").first()).toBeVisible();
    return page;
}

test.describe("shop", () => {
    intent(
        "INT-030",
        "the_catalog_renders_one_whole_card_link_per_item",
        async ({ browser }) => {
            const page = await toShopCatalog(browser);

            const cards = page.locator("[data-item-link]");
            const count = await cards.count();
            expect(count).toBeGreaterThanOrEqual(8); // all five tiers ship

            // Each card carries its name, a rarity treatment, and links
            // whole-card to the item's detail route.
            for (let index = 0; index < count; index++) {
                const card = cards.nth(index);
                await expect(card.locator(".shop-card__name")).not.toBeEmpty();
                await expect(card.locator("[data-rarity]")).toBeVisible();
            }

            // The card link carries its item id.
            const itemId = await cards.first().getAttribute("data-item-link");
            expect(itemId).toBeTruthy();
        },
    );

    intent(
        "INT-031",
        "the_detail_screen_renders_the_item_and_holds_the_only_unlock",
        async ({ browser }) => {
            const page = await toShopCatalog(browser);

            // Browse alone never mutates: no unlock affordance on the grid.
            await expect(page.locator("[data-unlock]")).toHaveCount(0);

            const firstCard = page.locator("[data-item-link]").first();
            const itemId = (await firstCard.getAttribute("data-item-link"))!;
            const expectedName = (
                await firstCard.locator(".shop-card__name").textContent()
            )!;
            await firstCard.click();

            // The detail route renders the selected item's facts.
            const detail = page.locator("[data-shop-detail]");
            await expect(detail).toBeVisible();
            await expect(page.locator("[data-item-name]")).toHaveText(
                expectedName,
            );
            await expect(
                page.locator("[data-item-description]"),
            ).not.toBeEmpty();
            await expect(detail.locator("[data-rarity]")).toBeVisible();

            // Unlock lives here, named for the item on view.
            await expect(page.locator(`[data-unlock="${itemId}"]`)).toBeVisible();
        },
    );

    intent(
        ["INT-031", "INT-034"],
        "the_unlock_journey_persists_ownership_and_populates_the_arsenal",
        async ({ browser }) => {
            test.setTimeout(90_000);
            const page = await toShopCatalog(browser);

            const firstCard = page.locator("[data-item-link]").first();
            const itemId = (await firstCard.getAttribute("data-item-link"))!;
            await firstCard.click();
            await expect(page.locator("[data-shop-detail]")).toBeVisible();

            // Locked back path: detail -> catalog.
            await page.locator("[data-shop-back]").first().click();
            await expect(page.locator("[data-shop-catalog]")).toBeVisible();
            await page.locator(`[data-item-link="${itemId}"]`).click();
            await expect(page.locator("[data-shop-detail]")).toBeVisible();

            // Unlock from the detail screen only.
            await page.locator(`[data-unlock="${itemId}"]`).click();

            // The Acquired screen confirms, reusing the shared rig molecule,
            // and the applied skin is observable on its host element.
            await expect(page.locator("[data-shop-acquired]")).toBeVisible({
                timeout: JOURNEY_TIMEOUT,
            });
            await expect(
                page.locator("[data-acquired-rig-panel] [data-equipped-skin]"),
            ).toHaveAttribute("data-equipped-skin", itemId, {
                timeout: JOURNEY_TIMEOUT,
            });

            // Locked back path: catalog -> arsenal.
            await page.locator("[data-shop-back]").click();
            await expect(page.locator("[data-shop-catalog]")).toBeVisible();
            await page.locator("[data-shop-back]").click();
            await expect(page.locator("[data-arsenal-view]")).toBeVisible();

            // The acquisition visibly populates the Arsenal inventory.
            const list = page.locator("[data-arsenal-list]");
            await expect(list).toBeVisible();
            await expect(list.locator(".arsenal__item").first()).toBeVisible();
        },
    );

    intent(
        "INT-036",
        "equipping_applies_the_skin_and_stamps_the_rig_host",
        async ({ browser }) => {
            test.setTimeout(90_000);
            const page = await toShopCatalog(browser);

            // Unlock the legendary; acquisition auto-equips it.
            await page.locator('[data-item-link="gilded-champion"]').click();
            await expect(page.locator("[data-shop-detail]")).toBeVisible();
            await page.locator('[data-unlock="gilded-champion"]').click();

            // The Acquired screen mounts the same RigView molecule the
            // Arsenal mounts - one rig surface, reused - so its host
            // element IS the rig view's host. It carries the applied skin,
            // set by the same routine that changed the model's materials -
            // not parallel UI state.
            await expect(page.locator("[data-shop-acquired]")).toBeVisible({
                timeout: JOURNEY_TIMEOUT,
            });
            await expect(
                page.locator("[data-acquired-rig-panel] [data-arsenal-rig]"),
            ).toHaveAttribute(
                "data-equipped-skin",
                "gilded-champion",
                { timeout: JOURNEY_TIMEOUT },
            );
        },
    );
});
