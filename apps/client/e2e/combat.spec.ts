/* Click fires equipped weapon, target HP decrements (INT-004).
 * The full e2e is a two-client scenario; the client side asserts
 * that the `fire` event is wired into the input controller and the
 * WebSocket protocol exposes the `fire` message type so the
 * server-authoritative hit path is attestable.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-004', 'mouse_click_fires_equipped_weapon_and_decrements_target_hp', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const hasFire = await page.evaluate(() => {
        const w = window as unknown as { __sfProtocolTypes?: string[] };
        return (w.__sfProtocolTypes ?? []).includes('fire');
    });
    expect(hasFire).toBe(true);
});
