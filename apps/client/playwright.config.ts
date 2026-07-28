import { defineConfig, devices } from '@playwright/test';

// Local runs serve the built app via `vite preview`; point BASE_URL at a
// deployed URL to run the same specs post-deploy and skip the local server.
const PORT = 4173;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 30_000 },
    workers: 1,
    reporter: 'line',
    use: {
        baseURL: BASE_URL,
        // WebGL under headless Chromium runs on SwiftShader; these flags
        // enable it, in CI included (REF-ThreeJS section 10).
        launchOptions: {
            args: [
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader',
                '--ignore-gpu-blocklist',
            ],
        },
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: process.env.BASE_URL
        ? undefined
        : {
              command: 'npm run preview',
              url: `http://localhost:${PORT}`,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
