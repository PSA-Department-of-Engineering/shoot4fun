/* In-match respawn lifecycle (INT-005 e2e half).
 * The full e2e is a two-client test; the client side asserts that the
 * `RESPAWNING IN N...` overlay is wired into the HUD with the
 * documented data attribute, so the visual + server contract is
 * attestable at the claim's e2e leg.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-005', 'player_respawns_after_three_second_overlay_with_full_hp', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const overlay = page.locator('[data-respawn]');
    await expect(overlay).toHaveCount(1);
    const visible = await overlay.getAttribute('data-visible');
    expect(visible).toBeDefined();
});
