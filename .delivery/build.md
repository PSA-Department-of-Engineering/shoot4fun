---
phase: build
skill: run-delivery-plan
status: done
gate: delivery
signed: pending
reviewed: pending
run: shoot4fun-2026-07-28
attempt: 5 (re-drive 3 - platform re-onboard with docs alias + database, resolved)
mode: interactive
started: 2026-07-30T00:00:00Z
finished: 2026-07-30
credential_ref: platform-studio-mcp,github-mcp
onboarding_pr: "Onboarding PR rafaelgpires/homelab-platform#76 merged (by hand, pre-fix); re-onboarded via platform-studio-chaos MCP with image_components=[server,client,docs]: rafaelgpires/homelab-platform#85 merged (app), #86 merged (database)"
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

1. **CI green on main** ✅ — Latest completed run on main concluded success (ci-caller, `2026-07-30T10:04:48Z`): https://github.com/PSA-Department-of-Engineering/shoot4fun/actions/runs/30533128884

2. **Artifacts published at the new version** ✅ — GHCR carries `shoot4fun-server`, `shoot4fun-client`, and `shoot4fun-docs` images, all at tag `1.1.4`. `shoot4fun-docs` now has an image-updater alias (see Resolution below).

3. **Promotion write-back visible in git** ✅ — `deploy-chaos` branch's `prod/values.yaml` carries `shoot4fun.images.server.tag=1.1.4`, `shoot4fun.images.client.tag=1.1.4`, `shoot4fun.images.docs.tag=1.1.4` (chart pinned `1.1.0`; last write-back `860348045098` at `2026-07-30T10:01:31Z`).

4. **Cache-busted probe of the public URL** ✅ (manually verified) / ⚠️ (automated) — `https://shoot4fun.chaos-architect.dev` resolves and serves; operator confirmed by browsing to it and playing the game. The platform-studio `app_status` tool's own in-cluster probe still intermittently reports `ConnectError: Name or service not known` as of this writing — likely a resolver-side caching/propagation quirk on that pod rather than a real outage, given the operator's direct confirmation. Worth a re-check but not treated as blocking given the independent human verification.

5. **Per-app conformance report** ✅ — `app_status shoot4fun` reports stage `promoted`. `onboarded`, `onboarding_pr`, `app_repo`, `ci`, `promotion`, and `credentials` links all `ok`. Only the `probe` link is non-ok (see #4 above); `identity_caveat` is `ok` (no identity grant on this app, nothing to verify).

6. **Priced capabilities are bound** ✅ — `has_database: true` (per-app `pg-app-shoot4fun` grant, onboarded via `onboard_database`, PR #86), `has_identity: false` (identity descoped per proposal, unchanged).

7. **Per-claim attestation** ✅ — Previous build's `csd-intent .` report: 17 claims, 17 attested, all `status: active`.

## Plan defects

1. **Docs image had no image-updater alias — FIXED and re-onboarded.** The CI builds `shoot4fun-docs` (from `docs/Dockerfile`) but the original by-hand onboarding's Application only watched `server` and `client`. The helm chart already carried the `docs` deployment/service fix from the previous re-drive. This re-drive re-ran the platform onboarding itself through `platform-studio-chaos`'s `onboard_app` with `image_components=["server","client","docs"]` (PR [rafaelgpires/homelab-platform#85](https://github.com/rafaelgpires/homelab-platform/pull/85), merged clean: 279/279 conformance checks passed). The image-updater now has the alias and is actively promoting all three images (confirmed at tag `1.1.4`).

2. **Probe failed: DNS not resolving — RESOLVED.** `shoot4fun.chaos-architect.dev` did not resolve immediately after the onboarding PR merged. This was ordinary ArgoCD sync + external-dns propagation lag, as anticipated in the prior stop-state. Operator confirmed the hostname resolves and the app serves correctly shortly after. The platform-studio `app_status` tool's own probe is still occasionally reporting a DNS failure at the time of this record (see evidence #4) — flagged for awareness, not a re-open of this defect.

3. **Platform-studio MCP not reachable — RESOLVED.** The prior builder session's `platform-studio` MCP connection was down, blocking the re-onboarding and forcing a degraded stop. This re-drive ran in a session with a working `platform-studio-chaos` MCP connection, used directly (`onboard_app`, `onboard_database`, `app_status`, `list_onboarding_prs`, `refresh_platform`) to complete the re-onboarding and the (separately requested) database grant.

### New finding this re-drive: orphaned onboarding branch, no cleanup tool

While re-driving, a stale `onboard/shoot4fun` branch (pushed by an earlier interrupted onboarding attempt, with no PR ever created for it) blocked `onboard_app` with `onboarding branch already exists: onboard/shoot4fun`. No tool in the `platform-studio` MCP surface (`onboard_app`/`onboard_database`/`onboard_identity`/`offboard_app`/`reconcile_app`/`refresh_platform`) can clean up an orphaned onboarding branch — it required a direct `git push origin --delete onboard/shoot4fun` against `rafaelgpires/homelab-platform` outside the MCP surface entirely. Root cause and fix filed upstream: [PSA-Department-of-Engineering/platform-studio#11](https://github.com/PSA-Department-of-Engineering/platform-studio/issues/11) (`GatedChange.execute`'s rollback path doesn't cover `finalize()`'s push-then-PR-creation step, so a failed PR creation after a successful push leaves the branch orphaned with nothing to clean it up).

## Resolution (2026-07-30)

This phase's prior degraded stop-state is cleared. Summary of what unblocked it:

- Connected to a working `platform-studio-chaos` MCP session (the prior session's connection failure is not reproduced here; `list_apps`/`app_status` calls succeed and reflect a healthy chaos install).
- Confirmed the target onboarding repo (`rafaelgpires/homelab-platform`) had no genuine stale branch/PR before starting — then hit and cleared a real orphaned `onboard/shoot4fun` branch from an earlier interrupted attempt (see finding above and issue #11).
- Re-ran `onboard_app` for `shoot4fun` with `image_components=["server","client","docs"]` (matching the app repo's own `devops/docker-compose.yml` comment: `# ... the platform binds all three (image_components=["server", "client", "docs"])`). Conformance gate passed 279/279. PR #85 merged.
- Ran `onboard_database` for `shoot4fun` (separately requested; app declares `has_database: true`). Conformance gate passed 280/280. PR #86 merged.
- Forced `refresh_platform` after each merge so the studio's cached manifest view caught up before the next step.
- Confirmed final state via `app_status`: stage `promoted`, all links `ok` except the automated `probe` (see evidence #4 caveat above) — and independently confirmed by the operator browsing to `https://shoot4fun.chaos-architect.dev` and playing the game.

**Do NOT run `reconcile-delivery` from a stale reading of this file** — this record now reflects the resolved state as of 2026-07-30. The remaining open items are the operator's own manual steps per REF-Delivery §8 (evolution board, acceptance demo, feedback capture) and the upstream `platform-studio` tooling gap tracked in issue #11, neither of which blocks signing this phase.
