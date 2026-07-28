/* The MVP arena is one bounded ground plane with 6-8 cover blocks
 * (INT-006). The Three.js scene graph is read via the test hooks.
 * Force offline mode (`?offline=1`) to avoid the WebSocket round-trip.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-006', 'mvp_arena_has_bounded_ground_with_simple_cover', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const counts = await page.evaluate(() => {
        const w = window as unknown as {
            __sfCountGround?: () => number;
            __sfCountCover?: () => number;
        };
        return {
            ground: w.__sfCountGround?.() ?? -1,
            cover: w.__sfCountCover?.() ?? -1,
        };
    });
    expect(counts.ground).toBe(1);
    expect(counts.cover).toBeGreaterThanOrEqual(6);
    expect(counts.cover).toBeLessThanOrEqual(8);
});
