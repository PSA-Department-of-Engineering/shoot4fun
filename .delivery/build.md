---
phase: build-ship
skill: run-delivery-plan
status: aborted
gate: delivery
signed: pending
reviewed: 2026-08-22
run: 
attempt: 1
mode: interactive
started: 2026-08-22T18:30:00Z
finished: 2026-08-23T00:45:00Z
credential_ref: 
onboarding_pr: none-required
---

# build.md - Shoot4Fun shop surface, build-and-ship log

## What was built (all committed and pushed)

Feature work rode the scratch ref `delivery/2026-08-21` in coherent units,
then merged to `main` (merge `a69662b`, after folding in upstream `9c363a1`;
fast-forward, conventional history intact):

| Unit | Commit | Contents |
|---|---|---|
| docs | `c6ae862` | Rarity legend in `docs/brand.md`; ADR-0008 authored before code |
| backend | `59d3a98` | Catalog file + validating loader; acquire/equip use cases over the Arsenal envelope; session-gated shop router; six integration suites; catalog ships in image (`Dockerfile COPY catalog`) |
| client | `c2b8e8a` | Catalog/detail/acquired screens; shared `applyCosmetic` routine + RigView consumption; arsenal inventory join with catalog metadata + enabled Browse-shop; menu Shop tile ready with caption rewritten ("cases" removed); five e2e tests |
| claims/docs | `6a6bd37` | INT-030..INT-038 activated (all attested); architecture.md routes |
| review fixes | `e280323` | Shared per-account write locks at the composition root (adversarial-review blocker); honest `data-equipped-skin` stamping; unlock errors surfaced; sensitive concurrency regression test |
| review record | `aca21e5`, `a528752` | `.delivery/reviews/build-2026-08-22.md` (closing pass VERDICT: PASS, recorded verbatim); ADR-0008 per-process scope note |

Verification at close of build: backend pytest **118 passed / 2 skipped**;
vitest **83 passed**; Playwright full suite **23 passed**; `tsc --noEmit`
clean; `vite build` clean; `csd-intent` audit **CLEAN** (38 claims, all nine
shop claims active and attested); postflight GO.

## Ship sequence executed (handoff §8)

1. Merged to `main` → CI green: test run
   https://github.com/PSA-Department-of-Engineering/shoot4fun/actions/runs/32601816837
   (client ✓, e2e ✓ 20m39s, backend ✓); release run
   https://github.com/PSA-Department-of-Engineering/shoot4fun/actions/runs/32601817068.
2. Release **v1.16.0** published 2026-08-22T22:14:38Z from `main`.
3. GHCR images pushed at 1.16.0: server digest `a88bf470…`,
   client `9c4c27c5…`, docs `e241cd03…` (release-run logs).
4. Promotion write-back on `deploy-chaos`: commit `c86891eb0080`
   (2026-08-22T22:16:49Z) pins all three tags to 1.16.0.
5. Install evidence (platform studio `app_status`): stage **serving**,
   every link ok; promotion ok at 1.16.0; probe HTTP 200 from
   https://shoot4fun.chaos-architect.dev (78 ms).
6. Freshness proven by feature presence, not a version string (the health
   endpoint's "0.1.0" is the backend package version, hardcoded):
   cache-busted `GET /api/shop/catalog` on the public URL returns the
   authored ten-item catalog — a route that exists only in ≥1.16.0 — and
   the edge serves client bundle `assets/index-BVm5ZeqN.js`, byte-identical
   hash to the local build of the shipped commit.

## Where it stopped: §10 degraded terminal state

The §9.6 app-specific smoke journey against the public URL fails at its
first step. **`POST /api/account/guest` returns 500 (empty body) from the
production edge**, reproducibly (8+ attempts across ~40 minutes,
2026-08-22T23:20Z–2026-08-23T00:40Z). Guest minting is the entry path for
every player journey, so browse→detail→unlock cannot be exercised live.

Evidence isolating the fault:

| Probe | Result |
|---|---|
| `GET /api/shop/catalog`, `/api/arenas`, `/api/health` | 200 |
| `POST /api/account/sign-in` (bogus creds) | 401 — accounts **SELECT** path healthy |
| `GET /api/account/me`, `/profile` unauthenticated | 200 (edge-cached responses; not diagnostic) |
| `POST /api/leaderboard/sandbox/score` (write, other table) | **200 — INSERT privilege works** |
| `POST /api/shop/acquire` unauthenticated | 401 — shop gating correct |
| `POST /api/account/guest` | **500 empty body, ~50 ms, every attempt** |

Reading: an instant, unhandled exception specific to INSERT into the
`accounts` table on the production database — consistent with a
privilege/RLS/index-state drift on that one table (the platform-minted
`pg-app-shoot4fun` role inserts fine elsewhere). The repo code is not the
suspect: identical account code passes the full suite including the
Postgres round-trip tests (#51/#63) in CI, and this run changed no
account-path code. The failure predates any of this run's write traffic to
prod (first probe already failed); no live evidence chain had ever
exercised prod writes before this one.

The wall: confirming and fixing needs pod logs or database state on the
managed instance — neither reachable with this run's tools or authorization
(no platform actions, no secrets, §0).

Plan defects encountered (smallest-reasonable choices, logged):

1. Handoff line-81 placeholder fixed pre-flight (operator-directed).
2. `backend/Dockerfile` gained `COPY catalog /app/catalog` — mechanical
   consequence of the pinned catalog path; without it the image cannot load
   the catalog.
3. Equip endpoint shaped as `POST /api/shop/equip {item_id}` (ADR-0008);
   UI re-equip affordance deferred (no claim requires it; endpoint tested).
4. Adversarial-review round 2 found the first lock fix ineffective under
   per-request construction; resolved by container-scoped shared registry
   covering BOTH writers, with a sensitivity-proven regression test.
5. INT-036 e2e ends at the Acquired screen's rig host (the same RigView
   molecule the Arsenal mounts); the extra Arsenal-view hop was dropped —
   SwiftShader freeze crossings added flake, not attestation.

## Next command

Degraded ending — do NOT reconcile. Smallest clearing action: inspect the
running server pod's logs for the guest-mint exception traceback (or check
INSERT grants/RLS on the platform's `accounts` table for
`pg-app-shoot4fun`), land whatever repo-side fix it names if any, then
re-drive this phase (`run-delivery-plan D:\Personal\shoot4fun`) — the build
is done and pushed, so a re-drive is verification + ship only.
