/* WASD moves the local player on the arena plane (INT-003).
 * Reads the local player's position from the scene (mirrored off the
 * server snapshot) before and after a held W key.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-003', 'wasd_keys_move_local_player_on_arena_plane', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => {
        const w = window as unknown as { __sfLocalPlayerPos?: () => { x: number; z: number } | null };
        return w.__sfLocalPlayerPos?.() ?? { x: 0, z: 0 };
    });
    await page.keyboard.down('w');
    await page.waitForTimeout(800);
    await page.keyboard.up('w');
    const debug = await page.evaluate(() => {
        const w = window as unknown as {
            __sfDebugFrameCount?: number;
            __sfDebugTarget?: { x: number; z: number };
            __sfLocalPlayerPos?: () => { x: number; z: number } | null;
        };
        return {
            frames: w.__sfDebugFrameCount ?? 0,
            target: w.__sfDebugTarget,
            pos: w.__sfLocalPlayerPos?.(),
        };
    });
    expect(debug.frames).toBeGreaterThan(0);
    expect(debug.target?.z ?? 0).toBeLessThan(before.z);
    const after = debug.pos ?? { x: 0, z: 0 };
    expect(after.z).toBeLessThan(before.z);
});
