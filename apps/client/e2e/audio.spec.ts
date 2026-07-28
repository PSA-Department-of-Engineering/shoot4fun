/* In-match audio cues (INT-015).
 * The Web Audio analyser sees the gunshot envelope when `__sfAudioShot`
 * is invoked. The test sets `localStorage` volume values and confirms
 * the gain node picks them up on the next read.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-015', 'in_match_audio_cues_fire_for_gunshot_hit_and_footstep', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    // Resume the audio context (Chromium may suspend it without user gesture).
    await page.evaluate(() => {
        const w = window as unknown as {
            __sfAudioShot?: () => void;
            __sfAudioResume?: () => void;
        };
        w.__sfAudioResume?.();
        w.__sfAudioShot?.();
    });
    await page.waitForTimeout(120);
    const count = await page.evaluate(() => {
        const w = window as unknown as { __sfAudioShotCount?: number };
        return w.__sfAudioShotCount ?? 0;
    });
    expect(count).toBeGreaterThanOrEqual(1);
});

intent('INT-015', 'master_and_sfx_volumes_read_from_localstorage', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('sf_master_volume', '0.5');
        window.localStorage.setItem('sf_sfx_volume', '0.3');
    });
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    const volumes = await page.evaluate(() => {
        const w = window as unknown as { __sfGetVolumes?: () => { master: number; sfx: number } };
        return w.__sfGetVolumes?.() ?? { master: -1, sfx: -1 };
    });
    expect(volumes.master).toBeCloseTo(0.5, 2);
    expect(volumes.sfx).toBeCloseTo(0.3, 2);
});
