import { defineConfig } from "vitest/config";

/* Unit tests only. The `e2e/` directory is Playwright's, and its specs
 * use the same `.spec.ts` suffix, so it is excluded explicitly rather
 * than left to vitest's default glob to pick up and fail on. */
export default defineConfig({
    test: {
        include: ["src/**/*.{test,spec}.ts"],
        exclude: ["e2e/**", "node_modules/**", "dist/**"],
        environment: "node",
    },
});
