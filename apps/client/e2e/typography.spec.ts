/* Guards the locked typography stack (design.md §1.2 / brand.md
 * "Typography"): the four self-hosted @font-face rules, the Wordmark
 * role (.wordmark, weight 900), the HUD display role (.hud-number,
 * Bungee), and the mono role (--font-mono, JetBrains Mono). Ticket #2
 * found this gap unguarded by any test, so a future revert of any of
 * these would ship silently again.
 */
import { expect, test } from '@playwright/test';

const LOCKED_FONT_FACES = ['Russo One', 'Bungee', 'Inter', 'JetBrains Mono'];

test('all four locked fonts are self-hosted via @font-face', async ({ page }) => {
    await page.goto('/?offline=1');
    const families = await page.evaluate(() => {
        const seen = new Set<string>();
        for (const sheet of Array.from(document.styleSheets)) {
            let rules: CSSRuleList;
            try {
                rules = sheet.cssRules;
            } catch {
                continue;
            }
            for (const rule of Array.from(rules)) {
                if (rule instanceof CSSFontFaceRule) {
                    seen.add(rule.style.getPropertyValue('font-family').replace(/["']/g, ''));
                }
            }
        }
        return Array.from(seen);
    });

    for (const family of LOCKED_FONT_FACES) {
        expect(families).toContain(family);
    }
});

test('the Wordmark role renders at the locked family and weight', async ({ page }) => {
    await page.goto('/?offline=1');
    // Same shape as the real markup (main.ts's click-to-play overlay,
    // Surface.ts's results banner): an h1.wordmark inside .card.
    const style = await page.evaluate(() => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = '<h1 class="wordmark">SHOOT4FUN</h1>';
        document.body.appendChild(card);
        const h1 = card.querySelector('h1.wordmark') as HTMLElement;
        const computed = getComputedStyle(h1);
        const result = {
            fontFamily: computed.fontFamily,
            fontWeight: computed.fontWeight,
            fontSize: parseFloat(computed.fontSize),
        };
        card.remove();
        return result;
    });

    expect(style.fontFamily).toContain('Russo One');
    expect(style.fontWeight).toBe('900');
    // Locked at 56-76px (design.md §1.2 / brand.md "Typography").
    expect(style.fontSize).toBeGreaterThanOrEqual(56);
    expect(style.fontSize).toBeLessThanOrEqual(76);
});

test('the HUD display numbers render in the locked Bungee face', async ({ page }) => {
    await page.goto('/?offline=1');
    // The HUD mounts unconditionally (src/ui/Hud.ts), so its real
    // .hud-number elements are in the DOM without a live match.
    const fontFamily = await page
        .locator('[data-ammo]')
        .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Bungee');
});

test('room code and keybind-hint text render in the locked JetBrains Mono face', async ({ page }) => {
    await page.goto('/?offline=1');
    const fontFamily = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.fontFamily = 'var(--font-mono)';
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).fontFamily;
        probe.remove();
        return value;
    });
    expect(fontFamily).toContain('JetBrains Mono');
});
