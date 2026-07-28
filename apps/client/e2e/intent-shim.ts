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

import { test as base } from "@playwright/test";

export function intent(
    claimId: string | string[],
    name: string,
    fn: Parameters<typeof base>[1],
): void {
    const ids = Array.isArray(claimId) ? claimId : [claimId];
    for (const id of ids) {
        base(`${id} :: ${name}`, fn);
    }
}
