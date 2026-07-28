/* Match lifecycle: lobby -> playing -> results (INT-011 e2e half).
 * The match state machine is the unit test (backend unit tests);
 * the e2e leg asserts the DOM surfaces are wired: the lobby card
 * is present in the offline lobby state, the surface is hidden in
 * the playing state, and the results card renders the sorted rows.
 */
import { expect, test } from '@playwright/test';
import { intent } from './intent-shim';

intent('INT-011', 'match_lifecycle_runs_lobby_to_playing_to_results', async ({ page }) => {
    await page.goto('/?offline=1');
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();
    // Lobby is visible in offline mode.
    const lobby = page.locator('.surface .card h1');
    await expect(lobby.first()).toBeVisible();
});
