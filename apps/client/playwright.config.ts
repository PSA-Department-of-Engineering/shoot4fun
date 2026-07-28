import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const RUN_WITH_BACKEND = process.env.SKIP_BACKEND !== '1';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    workers: 1,
    reporter: 'line',
    use: {
        baseURL: BASE_URL,
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
              command: RUN_WITH_BACKEND
                  ? `cmd /c e2e\\run-with-backend.cmd`
                  : 'npm run preview',
              url: `http://localhost:${PORT}`,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
              env: {
                  DATABASE_URL: '',
                  DISABLE_TICK_LOOP: '0',
              },
          },
});
