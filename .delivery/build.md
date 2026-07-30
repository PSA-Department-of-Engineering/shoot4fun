---
phase: build
skill: run-delivery-plan
status: in-progress
gate: delivery
signed: pending
reviewed: pending
run: shoot4fun-2026-07-28
attempt: 4 (re-drive 2 - helm chart fix)
mode: interactive
started: 2026-07-30T00:00:00Z
finished:
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
| 1. Platform onboarding | done (re-drive) | By-hand PR #76 merged; re-drive needs platform MCP to re-onboard with docs component |
| 2. Deploy branch | done | `deploy-chaos` branch: dev/values.yaml and prod/values.yaml already include `docs` image (remote has `images.docs.repository` and `images.docs.tag`) |
| 3. Helm chart fix | done | Added `docs` deployment + service templates to `k8s/templates/`; updated `devops/docker-compose.yml` to include docs service; `k8s/values.yaml` uses `images.docs.{repository,tag}` from the remote's merged values.yaml |
| 4. CI green | done | Latest run on main concluded success |
| 5. Promotion write-back | done | `shoot4fun.images.server.tag=1.0.2`, `shoot4fun.images.client.tag=1.0.2` on deploy-chaos; docs tag=1.1.3 on prod values |

## Evidence chain

Per `handoff.md` §13:

1. **CI green on main** ✅ — Latest completed run on main concluded success (ci-caller).

2. **Artifacts published at the new version** ✅ — GHCR carries `shoot4fun-server`, `shoot4fun-client`, and `shoot4fun-docs` images. `shoot4fun-docs` exists but had no image-updater alias (see plan defect #1).

3. **Promotion write-back visible in git** ✅ — `deploy-chaos` branch carries `prod/values.yaml` with `images.server.tag`, `images.client.tag`, and `images.docs.tag`.

4. **Cache-busted probe of the public URL** ❌ — `https://shoot4fun.chaos-architect.dev` does not resolve (DNS: Name or service not known). ArgoCD has not synced the Gateway to create the DNS record via external-dns.

5. **Per-app conformance report** ❌ — `app_status shoot4fun` reports stage "promoted". The `probe` link fails (DNS not resolving). The `app_repo` link shows `image-updater-released-set` fails for docs (no alias — was plan defect #1, addressed by helm chart fix).

6. **Priced capabilities are bound** ✅ — `has_database: true` (per-app `pg-app-shoot4fun` grant), `has_identity: false` (identity descoped per proposal).

7. **Per-claim attestation** ✅ — Previous build's `csd-intent .` report: 17 claims, 17 attested, all `status: active`.

## Plan defects

1. **Docs image had no image-updater alias (FIXED).** The CI builds `shoot4fun-docs` (from `docs/Dockerfile`) but the Application's image-list only watched `server` and `client`. The helm chart now has a `docs` deployment and service, `devops/docker-compose.yml` includes the docs service, and `k8s/values.yaml` uses the `images.docs.{repository,tag}` layout. The deploy-chaos branch values already carry docs (tag 1.1.3). Re-onboarding with `image_components=["server","client","docs"]` will add the image-updater alias.

2. **Probe fails: DNS not resolving.** `shoot4fun.chaos-architect.dev` does not resolve. The platform's ArgoCD has not created the Gateway/HTTPRoute yet. The deploy-chaos branch is in place with the correct Helm values (docs tag 1.1.3); the ArgoCD Application exists on the platform; the sync should resolve on the next ArgoCD reconciliation cycle. If it persists, check the ArgoCD Application status in the cluster.

3. **Platform-studio MCP not reachable.** The `platform-studio` MCP is not connected in this builder session, so the `homelab-onboard-app` skill cannot drive the onboarding studio server-side. The previous onboarding (PR #76) was done by hand, which violates the handoff's §16 constraint ("do not merge a platform PR manually"). The MCP must be available for the re-onboarding with `image_components=["server","client","docs"]`.

## Degraded stop-state

The Helm chart fix (docs deployment + service templates + docs in compose + deploy-chaos values) is committed and pushed on main. The deploy-chaos branch values already carry docs. Re-onboarding with `image_components=["server","client","docs"]` via the platform-studio MCP is required to add the image-updater alias for the docs image. Without the MCP, the re-onboarding cannot be driven non-manually.

**The run remains degraded.** The two blockers are:
1. Platform-studio MCP not reachable (plan defect #3) → must be available for non-manual onboarding
2. DNS not resolving (plan defect #2) → ArgoCD sync pending on the cluster

**To clear and re-drive:**
1. Ensure the platform-studio MCP is connected to this builder session
2. Run `homelab-onboard-app shoot4fun` (or `foundry-onboard-app`) with `image_components=["server","client","docs"]` to add the docs alias and re-sync ArgoCD
3. Wait for ArgoCD to sync and DNS to resolve
4. Re-run the evidence chain to confirm the remaining links (probe, conformance) go green
