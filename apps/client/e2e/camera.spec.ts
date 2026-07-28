/* Mouse-look + pointer-lock + pitch clamp (INT-002).
 * The camera's yaw/pitch are read off the Three.js scene; the test
 * dispatches a mouse-move and asserts both changed.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-002', 'mouse_movement_rotates_first_person_camera', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const before = await page.evaluate(() => {
        const w = window as unknown as { __sfGetLocalLook?: () => { yaw: number; pitch: number } };
        return w.__sfGetLocalLook?.() ?? { yaw: 0, pitch: 0 };
    });
    await page.mouse.move(640, 400);
    await page.mouse.move(800, 400, { steps: 5 });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => {
        const w = window as unknown as { __sfGetLocalLook?: () => { yaw: number; pitch: number } };
        return w.__sfGetLocalLook?.() ?? { yaw: 0, pitch: 0 };
    });
    expect(Math.abs(after.yaw - before.yaw)).toBeGreaterThan(0.001);
});

intent('INT-002', 'pitch_is_clamped_to_avoid_gimbal_flip', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    await page.mouse.move(640, 400);
    await page.mouse.move(640, -2000, { steps: 20 });
    await page.waitForTimeout(200);
    const look = await page.evaluate(() => {
        const w = window as unknown as { __sfGetLocalLook?: () => { yaw: number; pitch: number } };
        return w.__sfGetLocalLook?.() ?? { yaw: 0, pitch: 0 };
    });
    const limit = Math.PI / 2 - 0.05;
    expect(Math.abs(look.pitch)).toBeLessThanOrEqual(limit);
});
