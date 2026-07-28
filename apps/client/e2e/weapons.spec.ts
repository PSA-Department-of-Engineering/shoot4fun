/* Two distinct weapons selectable in-match (INT-013).
 * The lobby offers a 1/2 switch in the HUD; the test asserts both
 * `rifle` and `smg` are wired into the protocol.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-013', 'two_distinct_weapons_selectable_in_match', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const weapons = await page.evaluate(() => {
        const w = window as unknown as { __sfWeaponCatalog?: string[] };
        return w.__sfWeaponCatalog ?? [];
    });
    expect(weapons).toContain('rifle');
    expect(weapons).toContain('smg');
    expect(weapons.length).toBeGreaterThanOrEqual(2);
});
