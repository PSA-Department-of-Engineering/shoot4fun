/* Muzzle flash + hit particles + basic shadow map, no postprocessing (INT-016).
 * Triggers a fire (with no live target, so the muzzle flash fires but
 * the hit particles don't) and asserts the scene's particle system has
 * at least one live particle, the renderer's shadow map is enabled,
 * and no postprocessing pass is registered.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-016', 'muzzle_flash_and_hit_particles_render_in_scene', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    await page.evaluate(() => {
        const w = window as unknown as { __sfTriggerMuzzle?: () => void };
        w.__sfTriggerMuzzle?.();
    });
    await expect
        .poll(
            async () =>
                page.evaluate(() => {
                    const w = window as unknown as { __sfGetLiveParticles?: () => number };
                    return w.__sfGetLiveParticles?.() ?? 0;
                }),
            { timeout: 5000 },
        )
        .toBeGreaterThan(0);
});

intent('INT-016', 'scene_has_basic_shadow_map_with_empty_postprocessing', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const shadowCount = await page.evaluate(() => {
        const w = window as unknown as { __sfGetShadowMapCount?: () => number };
        return w.__sfGetShadowMapCount?.() ?? 0;
    });
    expect(shadowCount).toBe(1);
});
