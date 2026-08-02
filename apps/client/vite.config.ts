import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/* One build config, so module resolution has one definition.
 *
 * The unit tests import the app's own modules, so they need the same
 * `@/` alias the app is written against. Vitest reads its own config
 * file in preference to this one when both exist, so the `test` block
 * lives here: a second file would be a second copy of the alias, correct
 * until the day the two disagree.
 *
 * `e2e/` is Playwright's, and its specs carry the same `.spec.ts` suffix,
 * so it is excluded explicitly rather than left to a default glob.
 */

const proxy = {
    '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
    },
    '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
    },
};

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 4173,
        proxy,
    },
    preview: {
        port: 4173,
        proxy,
    },
    build: {
        target: 'esnext',
    },
    test: {
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
        environment: 'node',
    },
});
