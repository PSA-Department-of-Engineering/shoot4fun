---
phase: build
skill: run-delivery-plan
status: aborted
gate: delivery
signed: pending
reviewed: pending
run: shoot4fun-2026-07-28
attempt: 2 (re-drive)
mode: interactive
started: 2026-07-28T00:00:00Z
finished: 2026-07-29T20:50:00Z
credential_ref: platform-studio-mcp,csd-intent-mcp
onboarding_pr: "App onboarding PR #72 merged; database onboarding PR #74 merged"
---

# Build + ship — shoot4fun (re-drive 2)

## Build authorization

Per `.delivery/handoff.md` §17.5:
- Commits to `main` on the app repo: pre-authorized; every coherent unit was pushed as it reached a sensible state.
- Platform onboarding PRs opened (never merged): the app onboarding (PR #72) and database onboarding (PR #74) were accepted by the platform-studio and merged by the platform CI per ADR-036.
- The deploy-chaos branch was created as an orphan branch with dev/ and prod/ Helm values.

## Build sequence

| Step | Status | Notes |
|------|--------|-------|
| 1. Scaffold backend | done | bootstrap-hexagonal-backend → `backend/` |
| 2. Scaffold client | done | bootstrap-threejs-app → `apps/client/` |
| 3. Port intent stubs | done | Plan-time `tests/intent/` stubs ported to per-module test trees |
| 4. Land visual identity | done | `docs/brand.md`, `docs/logo.png`, rasterised icons |
| 5. Land architecture | done | `docs/architecture.md` + `docs/adr/0001-websocket-server-authoritative.md` |
| 6. Build backend engine | done | Domain + application + adapters + WebSocket handler |
| 7. Build client engine | done | Three.js scene, HUD, audio, particles, networking |
| 8. Wire per-claim tests | done | Backend 6 test files (pytest), Client 8 Playwright specs |
| 9. Wire CI caller | done | `.github/workflows/build.yml` (thin caller of platform reusable build) |
| 10. Platform onboarding DB | done | `foundry-onboard-database` PR #74 merged; `has_database: true` |
| 11. CI green | done | Latest run concluded success (ci-caller, 2026-07-29T17:19:42Z) |
| 12. Run audit | done | csd-intent: 17 claims, 17 attested, CLEAN |

## Evidence chain

Per `handoff.md` §13:

1. **CI green on main** ✅ — Latest completed run on main concluded success (ci-caller, 2026-07-29T17:19:42Z). All gate jobs passed.

2. **Artifacts published at the new version** ✅ — GHCR carries `shoot4fun-server`, `shoot4fun-client`, and `shoot4fun-docs` images at v1.0.2.

3. **Promotion write-back visible in git** ✅ — `deploy-chaos` branch exists with `prod/values.yaml` carrying `shoot4fun.images.server.tag: "1.0.2"` and `shoot4fun.images.client.tag: "1.0.2"`.

4. **Cache-busted probe of the public URL** ❌ — `https://shoot4fun.chaos-architect.dev` does not resolve (DNS: Name or service not known). The platform's ArgoCD has not synced the app to create the Gateway/HTTPRoute.

5. **Per-app conformance report is green** ❌ — `app_status shoot4fun` reports stage "promoted" (not "serving"). Two failed links:
   - `app_repo` failed: `image-updater-released-set[shoot4fun]` — CI builds `shoot4fun-docs` but no image-updater alias watches it
   - `probe` failed: DNS not resolving

6. **Priced capabilities are bound** ✅ — `has_database: true` (per-app `pg-app-shoot4fun` grant via PR #74), `has_identity: false` (identity descoped per proposal).

7. **Per-claim attestation** ✅ — `csd-intent .` reports 17 claims, 17 attested, CLEAN. All claims `status: active`.

## Plan defects

1. **Docs image has no image-updater alias.** The CI builds `shoot4fun-docs` (from `docs/Dockerfile`) as part of the platform's reusable build workflow, but `onboard_app` was called with `image_components=["server","client"]` before the docs/Dockerfile was added. `onboard_app` refuses to re-run on an existing app. The image exists in GHCR at v1.0.2 but the image-updater cannot promote it automatically. **Resolution**: docs must be manually promoted; the operator accepts this as a non-blocker.

2. **Probe fails: DNS not resolving.** `shoot4fun.chaos-architect.dev` does not resolve. The platform's ArgoCD has not created the Gateway/HTTPRoute yet. This is a platform-side sync that needs operator attention.

3. **Font files not committed.** The four self-hosted Google Fonts (Russo One, Bungee, Inter, JetBrains Mono) are not committed to `apps/client/public/fonts/`. The logo rasters were built using the `<text>`→`<path>` fallback. **Resolution**: the operator pins known-good WOFF2 URLs or downloads the fonts manually.

4. **INT-012 deployment probe test skipped.** The Playwright test in `apps/client/e2e/foundry/deployment.spec.ts` probes `https://shoot4fun.chaos-architect.dev` and requires the live hostname. This test will pass once the app is serving.

## Degraded stop-state

The build work (code, tests, CI, brand, architecture, Helm chart, deploy branch, database grant, 17 active claims) is complete and committed. The run cannot reach the live-verification done-definition because the platform's ArgoCD has not synced the app to the cluster — `shoot4fun.chaos-architect.dev` does not resolve.

**The run ends degraded.** The operator clears this by:

1. Verifying the platform's ArgoCD sync for the shoot4fun Application on the deploy-chaos branch. Check that the Gateway, HTTPRoute, and Namespace have been created in the cluster.
2. Accepting that the docs image (`shoot4fun-docs`) is manually promoted (no image-updater alias exists for it).
3. Once the probe succeeds, re-running the evidence chain to confirm the remaining links (probe, conformance) go green.

**Do NOT run `reconcile-delivery` from this state.** A degraded run is not finished (REF-Delivery.md §6, anti-pattern 26). Re-drive this phase once the ArgoCD sync resolves.

**Next command for the operator:** Clear the recorded blocker (verify platform ArgoCD sync for shoot4fun on deploy-chaos), then re-drive this phase to the done-definition via `run-delivery-plan` once `shoot4fun.chaos-architect.dev` resolves.
