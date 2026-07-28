import { expect, test } from '@playwright/test';

test('the scene mounts, renders a first frame, and logs no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    // data-scene-ready flips on the first rendered frame (src/scene/SceneApp.ts);
    // reaching it proves the WebGL context and the animation loop are alive.
    await expect(page.locator('#app[data-scene-ready="true"]')).toBeAttached();

    const canvas = page.locator('#app canvas').first();
    await expect(canvas).toBeVisible();
    const size = await canvas.evaluate((el) => ({
        w: (el as HTMLCanvasElement).width,
        h: (el as HTMLCanvasElement).height,
    }));
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);

    expect(errors).toEqual([]);
});
