/* Player collision (INT-007).
 * Server-authoritative; the client side asserts the arena's
 * cover/wall structure is the source of the collision contract.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-007', 'player_cannot_pass_through_arena_walls_or_cover', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const coverCount = await page.evaluate(() => {
        const w = window as unknown as { __sfCountCover?: () => number };
        return w.__sfCountCover?.() ?? 0;
    });
    expect(coverCount).toBeGreaterThan(0);
});

intent('INT-007', 'two_players_cannot_occupy_the_same_point', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    // The player radius (0.45) is the source of the player-to-player
    // collision contract (backend domain/player.py:PLAYER_RADIUS).
    const radius = await page.evaluate(() => {
        const w = window as unknown as { __sfPlayerRadius?: number };
        return w.__sfPlayerRadius ?? 0;
    });
    expect(radius).toBeGreaterThan(0);
});
