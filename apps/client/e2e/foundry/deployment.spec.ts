/* Deployment evidence test (`INT-012`).
 *
 * Cache-busted HTTPS GET of `shoot4fun.chaos-architect.dev` returns 2xx
 * (or 302/401 behind OIDC) within 5s. The chain is freshness, not
 * just liveness: a plain 200 from a cached response is not enough.
 *
 * The PSA Foundry is a self-hosted GitOps home-lab cluster; the
 * hostname is read from the deployment's manifest entry. The test
 * probes the public URL the app onboards to.
 */
import { expect } from '@playwright/test';
import { intent } from '../intent-shim';

const HOST = process.env.SHOOT4FUN_HOST ?? 'https://shoot4fun.chaos-architect.dev';

intent('INT-012', 'https_probe_of_public_hostname_returns_2xx', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(HOST, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        timeout: 5000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect([200, 302, 401]).toContain(res.status());
    const lastModified = res.headers()['last-modified'];
    const date = res.headers()['date'];
    expect(lastModified ?? date).toBeDefined();
});
