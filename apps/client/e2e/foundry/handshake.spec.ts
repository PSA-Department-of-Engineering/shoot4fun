/* Live match-handshake evidence (`INT-011`).
 *
 * Drives the lobby -> playing transition against the REAL deployed server
 * through the UI a player actually uses: two browsers open the same room,
 * both click Ready, the host clicks Start match, and the lobby closes onto
 * a running match.
 *
 * It is deliberately UI-driven rather than socket-driven. A test that opens
 * a WebSocket and sends `set_ready` itself passes even when the game is
 * unplayable, because the server answers `set_ready` perfectly well — the
 * bug this guards against is that the client is never told which room it
 * joined, so `main.ts`'s `scene.onState` never fires, `surface.show("lobby")`
 * never runs, and no Ready button ever exists for a human to click. The
 * player sees an empty sky and a default HUD forever. Asserting on the
 * Ready button is what makes that visible; asserting on the socket hides it.
 *
 * Run against a deployment (BASE_URL suppresses the local webServer):
 *   BASE_URL=https://shoot4fun.chaos-architect.dev npx playwright test e2e/foundry
 */
import { expect, type Browser, type Page } from '@playwright/test';
import { intent } from '../intent-shim';

const HOST =
    process.env.SHOOT4FUN_HOST ??
    process.env.BASE_URL ??
    'https://shoot4fun.chaos-architect.dev';

/* One player: a fresh context with the name pre-seeded (main.ts otherwise
 * blocks on window.prompt), landed on the shared room, past the click-to-play
 * overlay that covers the surface. */
async function openPlayer(browser: Browser, room: string, name: string): Promise<Page> {
    const context = await browser.newContext();
    await context.addInitScript(
        ([n]) => window.localStorage.setItem('sf_player_name', n as string),
        [name],
    );
    const page = await context.newPage();
    await page.goto(`${HOST}/#/${room}`);
    // The overlay is added after the socket opens; it covers the lobby.
    const overlay = page.locator('text=Click to play');
    if (await overlay.isVisible({ timeout: 8000 }).catch(() => false)) {
        await overlay.click();
    }
    return page;
}

intent('INT-011', 'two_players_can_ready_up_and_start_a_match_in_the_browser', async ({ browser }) => {
    const room = 'E2E' + Date.now().toString(36).slice(-5).toUpperCase();

    const host = await openPlayer(browser, room, 'e2e-host');
    const guest = await openPlayer(browser, room, 'e2e-guest');

    /* The regression guard: the lobby has to exist for a player at all. If the
     * server never sends the joining client a room snapshot, this is where it
     * fails — no Ready button is ever rendered. */
    await expect(
        host.locator('[data-ready]'),
        'the host never got a lobby (no room snapshot delivered on join)',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
        guest.locator('[data-ready]'),
        'the guest never got a lobby (no room snapshot delivered on join)',
    ).toBeVisible({ timeout: 20_000 });

    await host.locator('[data-ready]').click();
    await guest.locator('[data-ready]').click();

    /* Start match is host-only and gated on every player being ready
     * (Surface.ts), and a room needs 2+ players to be a match (INT-008). */
    const start = host.locator('[data-start]');
    await expect(start, 'Start match never became enabled for the host').toBeEnabled({
        timeout: 20_000,
    });
    await start.click();

    /* Leaving LOBBY hides the surface (main.ts), which is only reachable if the
     * server accepted start_match and the tick loop is broadcasting state. */
    await expect(
        host.locator('[data-ready]'),
        'the lobby never closed, so the match did not reach PLAYING',
    ).toBeHidden({ timeout: 20_000 });

    await host.context().close();
    await guest.context().close();
});
