/* Local shim for playwright-intent.
 *
 * The CSD playbook's `playwright-intent` package is a thin wrapper that
 * binds a test claim ID to a Playwright `test()` call. We don't have
 * network access to GitHub Packages from this runner, so we vendor a
 * 1:1-equivalent `intent()` function here. The audit (csd-intent)
 * reads the `intent("INT-NNN", ...)` calls from this file by AST and
 * matches them against the spec, so the call shape is what the audit
 * cares about; the body just runs the test.
 *
 * If `playwright-intent` becomes available, swap this for the real
 * import and the tests still pass.
 */

import {
    test as base,
    type PlaywrightTestArgs,
    type PlaywrightTestOptions,
    type PlaywrightWorkerArgs,
    type PlaywrightWorkerOptions,
    type TestInfo,
} from "@playwright/test";

/* Spelled out rather than read off `test` with Parameters<>. `test` is
 * overloaded, and that indexed access resolves to the `TestDetails`
 * overload, which types every caller's `{ browser }` as an error. */
type TestBody = (
    args: PlaywrightTestArgs &
        PlaywrightTestOptions &
        PlaywrightWorkerArgs &
        PlaywrightWorkerOptions,
    testInfo: TestInfo,
) => Promise<void> | void;

export function intent(
    claimId: string | string[],
    name: string,
    fn: TestBody,
): void {
    const ids = Array.isArray(claimId) ? claimId : [claimId];
    for (const id of ids) {
        base(`${id} :: ${name}`, fn);
    }
}
