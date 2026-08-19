/* Opt-in login and profile reconciliation, played from the menu.

These drive the real client against the real backend (Playwright starts
both), the same way `match.spec.ts` does, but stay on the menu surface:
they never enter a match room. They pin INT-023 (the login panel is
mounted and reachable), INT-024 (a guest reaches and plays without ever
registering), and INT-025 (local settings reconcile with the server-side
profile and survive a sign-out / sign-in).
*/
import { expect, test, type Browser } from "@playwright/test";

import { intent } from "./intent-shim";

/** Reach the main menu as a guest or via the login entry, no room joined. */
async function openMenu(browser: Browser, entry: "guest" | "login") {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.locator(`[data-launch="${entry}"]`).click();
    await expect(page.locator("[data-account-panel]")).toBeVisible();
    return { context, page };
}

intent(
    "INT-023",
    "opt-in login panel is mounted and reachable from the menu",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser, "login");

        // The two optional acts the panel offers are both reachable.
        await expect(page.getByRole("button", { name: "Keep this name" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

        // Register dialog opens.
        await page.getByRole("button", { name: "Keep this name" }).click();
        await expect(page.locator("#account-name")).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();

        // Sign-in dialog opens.
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.locator("#signin-name")).toBeVisible();
        await expect(page.locator("#signin-code")).toBeVisible();

        await context.close();
    },
);

intent(
    "INT-024",
    "a guest reaches the menu and plays without registering",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser, "guest");

        // The panel shows the guest state, not a wall.
        await expect(page.locator("[data-account-panel]")).toContainText("guest");

        // The playable tiles are reachable and not gated on login.
        await expect(page.locator('[data-tile="versus"]')).toBeVisible();
        await expect(page.locator('[data-tile="arsenal"]')).toBeEnabled();

        // Entering a game surface never forces a login dialog: the menu is
        // replaced by the solo range without a single account prompt.
        await page.locator('[data-tile="training"]').click();
        await expect(page.locator(".menu-tiles")).toBeHidden();

        await context.close();
    },
);

intent(
    "INT-025",
    "local settings reconcile with the server profile across sign-out and sign-in",
    async ({ browser }) => {
        test.setTimeout(60_000);
        const { context, page } = await openMenu(browser, "login");

        const displayName = `Recon${Date.now().toString(36)}`;

        // Register this guest into a named account and capture the code.
        await page.getByRole("button", { name: "Keep this name" }).click();
        await page.locator("#account-name").fill(displayName);
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator("[data-recovery-code]")).toBeVisible();
        const code = (await page.locator("[data-recovery-code]").textContent())?.trim();
        expect(code && code.length).toBeGreaterThan(0);
        await page.getByRole("button", { name: "I saved it" }).click();

        // Change a preference; a registered player's dial pushes to the server.
        await page.locator("[data-settings]").click();
        await page
            .locator("#setting-sensitivity")
            .evaluate((el) => {
                const input = el as HTMLInputElement;
                // Use the native value setter so React's controlled-input
                // tracker sees the change and fires onChange.
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value",
                )!.set!;
                setter.call(input, "0.004");
                input.dispatchEvent(new Event("input", { bubbles: true }));
            });
        await page.locator("[data-settings-close]").click();

        // Sign out, then back in with the saved code.
        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.locator("#signin-name").fill(displayName);
        await page.locator("#signin-code").fill(code!);
        await page.getByRole("button", { name: "Sign in" }).click();

        // Signed back in; the server's stored dial is the source of truth.
        await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => window.localStorage.getItem("sf_sensitivity")))
            .toBe("0.004");

        await context.close();
    },
);
