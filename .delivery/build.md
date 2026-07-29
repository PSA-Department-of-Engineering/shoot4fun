---
phase: build
skill: run-delivery-plan
status: aborted
gate: delivery
signed: pending
reviewed: pending
run: shoot4fun-2026-07-28
attempt: 3 (re-drive)
mode: interactive
started: 2026-07-29T21:00:00Z
finished: 2026-07-29T21:40:00Z
credential_ref: platform-studio-mcp,github-mcp
onboarding_pr: "Onboarding PR rafaelgpires/homelab-platform#76 merged; deploy-chaos branch created"
---

# Build + ship — shoot4fun (re-drive 3)

## Build authorization

Per `.delivery/handoff.md` §17.5:
- Commits to `main` on the app repo: pre-authorized; every coherent unit was pushed as it reached a sensible state.
- Platform onboarding PR opened via by-hand commit to `rafaelgpires/homelab-platform` (PR #76, merged by auto-merge workflow).
- Deploy-chaos branch created as orphan branch with `prod/` and `dev/` Helm values.

## Build sequence

| Step | Status | Notes |
|------|--------|-------|
| 1. Platform onboarding | done | By-hand: `foundry.yaml` entry + `teams/shoot4fun/` via PR #76, merged at 2026-07-29T21:20:32Z |
| 2. Deploy branch | done | `deploy-chaos` branch created on `PSA-Department-of-Engineering/shoot4fun` with `prod/values.yaml` and `dev/values.yaml` |
| 3. CI green | done | Latest run on main concluded success (ci-caller, 2026-07-29T20:09:59Z) |
| 4. Promotion write-back | done | `shoot4fun.images.server.tag=1.0.2`, `shoot4fun.images.client.tag=1.0.2` on deploy-chaos |
| 5. Credentials | done | `pg-app-shoot4fun` grant in `teams/shoot4fun/`; `has_database: true` |
| 6. Conformance | 255 passed, 1 failed | `image-updater-released-set` fails: CI builds `shoot4fun-docs` but no image-updater alias watches it (known plan defect; operator accepted) |

## Evidence chain

Per `handoff.md` §13:

1. **CI green on main** ✅ — Latest completed run on main concluded success (ci-caller, 2026-07-29T20:09:59Z).

2. **Artifacts published at the new version** ✅ — GHCR carries `shoot4fun-server` and `shoot4fun-client` images (per CI green + image-updater-released-set confirming their existence). `shoot4fun-docs` also exists but has no alias.

3. **Promotion write-back visible in git** ✅ — `deploy-chaos` branch at commit d9c3545 carries `prod/values.yaml` with `shoot4fun.images.server.tag: "1.0.2"` and `shoot4fun.images.client.tag: "1.0.2"`.

4. **Cache-busted probe of the public URL** ❌ — `https://shoot4fun.chaos-architect.dev` does not resolve (DNS: Name or service not known). ArgoCD has not synced the Gateway to create the DNS record via external-dns.

5. **Per-app conformance report** ❌ — `app_status shoot4fun` reports stage "promoted" (not "serving"). The `probe` link fails (DNS not resolving). The `app_repo` link shows `image-updater-released-set` failed (docs image has no alias — known plan defect).

6. **Priced capabilities are bound** ✅ — `has_database: true` (per-app `pg-app-shoot4fun` grant), `has_identity: false` (identity descoped per proposal).

7. **Per-claim attestation** ✅ — Previous build's `csd-intent .` report (carried forward): 17 claims, 17 attested, all `status: active`.

## Plan defects

1. **Docs image has no image-updater alias.** The CI builds `shoot4fun-docs` (from `docs/Dockerfile`) but the Application's image-list only watches `server` and `client`. The image exists in GHCR but cannot auto-promote. **Resolution**: docs must be manually promoted; operator accepted as non-blocker in previous run.

2. **Probe fails: DNS not resolving.** `shoot4fun.chaos-architect.dev` does not resolve. The platform's ArgoCD has not created the Gateway/HTTPRoute yet. The deploy-chaos branch is in place with the correct Helm values; the ArgoCD Application exists on the platform; the sync should resolve on the next ArgoCD reconciliation cycle. If it persists, check the ArgoCD Application status in the cluster.

## Degraded stop-state

The build work (code, tests, CI, brand, architecture, Helm chart, deploy branch, database grant, platform onboarding, promotion) is complete and committed. The run cannot reach the live-verification done-definition because the platform's ArgoCD has not synced the app to the cluster — `shoot4fun.chaos-architect.dev` does not resolve.

**The run ends degraded.** The operator clears this by:

1. Verifying the platform's ArgoCD sync for the shoot4fun Application on the deploy-chaos branch. Check that the Gateway, HTTPRoute, and Namespace have been created in the cluster. If the sync has not triggered, manually sync the Application in the ArgoCD UI or use the ArgoCD CLI.
2. Accepting that the docs image is manually promoted (no image-updater alias exists for it — plan defect #1).
3. Once the probe succeeds, re-running the evidence chain to confirm the remaining links (probe, conformance) go green.

**Do NOT run `reconcile-delivery` from this state.** A degraded run is not finished (REF-Delivery.md §6, anti-pattern 26). Re-drive this phase once the ArgoCD sync resolves.

**Next command for the operator:** Clear the recorded blocker (verify platform ArgoCD sync for shoot4fun on deploy-chaos; manually sync if needed), then re-drive this phase to the done-definition via `run-delivery-plan` once `shoot4fun.chaos-architect.dev` resolves.
