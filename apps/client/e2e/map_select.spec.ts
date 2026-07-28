/* The lobby exposes at least two arena maps (INT-014).
 * The lobby DOM has a `<select>` for the host with both `sandbox` and
 * `atrium` options.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-014', 'lobby_exposes_two_or_more_arena_maps_for_host_selection', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    await expect
        .poll(
            async () =>
                page.evaluate(() => {
                    const sel = document.querySelector('[data-map]') as HTMLSelectElement | null;
                    if (!sel) return 0;
                    return sel.options.length;
                }),
            { timeout: 5000 },
        )
        .toBeGreaterThanOrEqual(2);
    const options = await page.evaluate(() => {
        const sel = document.querySelector('[data-map]') as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options).map((o) => o.value);
    });
    expect(options).toContain('sandbox');
    expect(options).toContain('atrium');
    expect(options.length).toBeGreaterThanOrEqual(2);
});
