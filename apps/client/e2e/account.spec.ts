/* Opt-in login, guest access, and profile reconciliation (issue #41).
 *
 * These drive the real app against a real server, the same way `match.spec.ts`
 * does. They assert the client-surface contract the backend already guarantees:
 * login is surfaced but never required (INT-023/024), and a signed-in player's
 * preferences follow them across a sign-out and back in (INT-025).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { intent } from "./intent-shim";

/** Land on the main menu as a guest and wait for the account panel to mount. */
async function toMenu(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.locator('[data-launch="guest"]').click();
    await expect(page.locator('[data-account-panel]')).toBeVisible();
    return page;
}

/** A guest reaches the lobby without ever registering or signing in. */
async function guestReachesLobby(page: Page): Promise<void> {
    await page.locator('[data-tile="versus"]').click();
    // The create-room control is enabled once a player name is set.
    await page.locator('#player-name').fill('GuestBot');
    await page.locator('[data-create-room]').click();
    await expect(page.locator('[data-ready]')).toBeVisible();
}

/** Set the mouse-sensitivity slider to a value and close the dialog. */
async function setSensitivity(page: Page, value: string): Promise<void> {
    await page.locator('[data-settings]').click();
    await expect(page.locator('[data-settings-dialog]')).toBeVisible();
    await page.locator('#setting-sensitivity').evaluate((el, val) => {
        const input = el as HTMLInputElement;
        const descriptor = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        );
        const setter = descriptor ? descriptor.set : null;
        if (setter) setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.locator('[data-settings-close]').click();
}

/** The sensitivity the server holds for the current session, read straight
 *  from the API the client itself uses (the review's point: local state can
 *  agree with itself while the server never heard a thing). */
async function serverSensitivity(page: Page): Promise<number> {
    return page.evaluate(async () => {
        const token = window.localStorage.getItem('sf_session');
        const response = await fetch('/api/account/profile', {
            headers: token ? { 'X-S4F-Session': token } : {},
        });
        const body = (await response.json()) as { sensitivity: number };
        return body.sensitivity;
    });
}

test.describe("account", () => {
    intent(
        "INT-023",
        "opt_in_login_is_surfaced_in_the_menu_but_never_required",
        async ({ browser }) => {
            const page = await toMenu(browser);
            // The panel is mounted in the menu surface, so create-account and
            // sign-in are reachable.
            await expect(page.locator('[data-account-panel]')).toBeVisible();
            await page.getByRole('button', { name: 'Create account' }).click();
            await expect(page.locator('#account-name')).toBeVisible();

            // Closing the dialog leaves the match path intact: a guest can still
            // open a room.
            await page.getByRole('button', { name: 'Cancel' }).click();
            await guestReachesLobby(page);
        },
    );

    intent(
        "INT-024",
        "a_guest_reaches_a_match_without_registering_or_signing_in",
        async ({ browser }) => {
            const page = await toMenu(browser);
            // No dialog opened, no name entered: the lobby is reachable as a
            // guest, so login is not a gate to play.
            await guestReachesLobby(page);
        },
    );

    intent(
        "INT-024",
        "account_service_failure_degrades_to_a_guest_offline_session",
        async ({ browser }) => {
            const page = await browser.newPage();

            // Simulate the account service being unreachable: every account
            // call fails the way a network partition would. The match server
            // is a separate process and stays up, so this isolates the
            // account-service failure the claim's degradation clause is about
            // rather than taking the whole game down.
            let accountCalls = 0;
            await page.route("**/api/account/**", async (route) => {
                accountCalls++;
                await route.abort();
            });

            await page.goto("/");
            // The entry screen still offers guest play, and choosing it is not
            // gated on the account call succeeding: hydrate() lands in its
            // offline phase instead of stranding the player at a wall.
            await page.locator('[data-launch="guest"]').click();
            await expect(page.locator('[data-tile="versus"]')).toBeVisible();

            // And a guest still reaches a lobby and can ready up, so play is
            // not blocked by the outage.
            await page.locator('[data-tile="versus"]').click();
            await page.locator('#player-name').fill('OfflineBot');
            await page.locator('[data-create-room]').click();
            await expect(page.locator('[data-ready]')).toBeVisible();

            // The failure was actually exercised, so this is the degraded path
            // and not a test that never touched the account service.
            expect(accountCalls).toBeGreaterThan(0);
        },
    );

    intent(
        "INT-025",
        "local_settings_reconcile_with_the_server_profile_across_sign_in",
        async ({ browser }) => {
            const page = await toMenu(browser);
            const name = `Recon${Date.now().toString(36)}`;
            const password = "reconpass12";

            // Create an account with a name and a password.
            await page.getByRole('button', { name: 'Create account' }).click();
            await page.locator('#account-name').fill(name);
            await page.locator('#account-password').fill(password);
            await page.getByRole('button', { name: 'Create' }).click();

            // Change a preference; the PUT that carries it actually lands.
            const pushed = page.waitForResponse(
                (response) =>
                    response.url().endsWith('/api/account/profile') &&
                    response.request().method() === 'PUT',
            );
            await setSensitivity(page, '0.004');
            await pushed;
            // And the server holds the new value, not just the local key.
            await expect
                .poll(() => serverSensitivity(page))
                .toBe(0.004);
            await expect
                .poll(() => page.evaluate(() => localStorage.getItem('sf_sensitivity')))
                .toBe('0.004');

            // Sign out, then back in with the password. While signed out the
            // player is a guest, whose dials are local-only, so a divergent value
            // stays put until the pull lands.
            await page.getByRole('button', { name: 'Sign out' }).click();
            await expect(
                page.getByRole('button', { name: 'Sign in' }),
            ).toBeVisible();
            await page.evaluate(() =>
                localStorage.setItem('sf_sensitivity', '0.001'),
            );
            await page.getByRole('button', { name: 'Sign in' }).first().click();
            await page.locator('#signin-name').fill(name);
            await page.locator('#signin-password').fill(password);
            await page.getByRole('button', { name: 'Sign in' }).last().click();

            // The stored preference now reflects the server profile pulled on
            // (re)sign-in: a divergent local value was overwritten, so this is not
            // the local copy agreeing with itself.
            await expect
                .poll(() => page.evaluate(() => localStorage.getItem('sf_sensitivity')))
                .toBe('0.004');
        },
    );
});
