/* The 3D scene mounts a WebGL canvas and presents a live frame within 2s
 * of the lobby hand-off (INT-001).
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-001', 'scene_presents_webgl_canvas_within_two_seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached({
        timeout: 2000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    const canvas = page.locator('#app canvas').first();
    await expect(canvas).toBeVisible();
});
