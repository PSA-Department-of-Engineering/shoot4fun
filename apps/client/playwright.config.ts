import { defineConfig, devices } from "@playwright/test";

/* The e2e suite drives the real game against a real server.
 *
 * Playwright starts both processes itself, cross-platform, rather than
 * shelling out to a platform-specific launcher carrying absolute paths:
 * a harness that only runs on the machine it was written on is a
 * harness that never runs in CI.
 *
 * `e2e/foundry/` targets a deployment instead and is skipped unless a
 * host is supplied. Point the whole suite at a deployment with BASE_URL,
 * which suppresses the local servers.
 */

const PORT = 4173;
const BACKEND_PORT = 8000;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const PYTHON = process.env.PYTHON ?? "python";

// `e2e/foundry/` probes a live deployment, so it is opt-in: without a host it
// would fail on every machine that is not pointed at the cluster, and a suite
// that is expected to be red is a suite nobody reads.
const FOUNDRY_IGNORE = process.env.SHOOT4FUN_HOST ? [] : ["**/foundry/**"];

export default defineConfig({
    testDir: "./e2e",
    testIgnore: FOUNDRY_IGNORE,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    workers: 1,
    forbidOnly: !!process.env.CI,
    // Two retries in CI: the e2e project drives the real game against a
    // live server, and INT-003's physics assertions sample a simulation
    // that is timing-sensitive under CI load. A single intermittent
    // timing miss is absorbed rather than re-running the whole suite
    // (issue #59).
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "line",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        launchOptions: {
            args: [
                // Headless WebGL in CI runs on SwiftShader.
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--ignore-gpu-blocklist",
            ],
        },
    },
    projects: [
        {
            name: "chromium",
            // The mouse-and-keyboard match, driven under pointer lock. The
            // touch overlay never mounts on a fine pointer, so its spec would
            // be an empty file here - exclude it rather than run nothing.
            testIgnore: [...FOUNDRY_IGNORE, "**/touch.spec.ts"],
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "touch",
            // A phone: a coarse primary pointer AND at least one touch point,
            // the pair `isTouchDevice()` (src/input/touch.ts) gates the
            // on-screen overlay on. Pixel 5's descriptor sets `isMobile`
            // (which makes `(pointer: coarse)` match) and `hasTouch`
            // (`maxTouchPoints > 0`); together they mount `TouchControls`
            // where desktop chromium shows the pointer-lock gate. This project
            // runs only the touch spec (INT-018) - the desktop match specs
            // assume a lock a phone has not got.
            testMatch: "**/touch.spec.ts",
            use: { ...devices["Pixel 5"] },
        },
    ],
    webServer: process.env.BASE_URL
        ? undefined
        : [
              {
                  command: `${PYTHON} -m uvicorn shoot4fun_backend.adapters.inbound.http.app:create_app --factory --host 127.0.0.1 --port ${BACKEND_PORT} --log-level warning`,
                  cwd: "../../backend",
                  url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 60_000,
                  env: { DATABASE_URL: "", DISABLE_TICK_LOOP: "0" },
              },
              {
                  // Build before serving: `playwright test` on its own
                  // serves whatever is already in dist/, so a stale
                  // bundle silently tests the previous commit.
                  command: "npm run build && npm run preview",
                  url: `http://localhost:${PORT}`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
              },
          ],
});
