---
phase: intent+plan
skill: intent-session
status: complete
gate: plan
signed: 2026-08-22
reviewed: 2026-08-22
run: 
attempt: 1
mode: interactive
started: 2026-08-22T17:18:17Z
finished: 2026-08-22T17:49:34Z
credential_ref: 
---

# handoff.md - Shoot4Fun, one-shot autonomous delivery handoff

<!-- intent-session wrote this into the delivery scratch as .delivery/handoff.md
     (REF-Delivery.md section 4b): the ephemeral build plan, assembled from the
     durable sources, committed with the rest of the scratch, consumed by the
     build, deleted at reconcile. -->

This is the complete handover for an autonomous implementation run. Every decision is pinned or pointed at its durable home, this run is authorized by §0, every external dependency has a pre-flight and a degraded stop-state, and any point that genuinely needs a human becomes a §10 degraded stop-state. If executing this handoff ever requires a decision not written or pointed to here, that is a handoff defect: make the smallest reasonable choice, record it in the final report under "plan defects", and continue. Do not stop to ask.

## 0. Mission, authorization, done-definition

**Mission.** Add the shop surface to Shoot4Fun — a live multiplayer Three.js shooter at `https://shoot4fun.chaos-architect.dev` — so a signed-in player can browse cosmetics, acquire them (free unlock; monetization explicitly deferred), and apply them to their player model, with ownership persisted into the delivered Arsenal envelope (ADR-0007). The verbatim request lives in `.delivery/request.md`; the requirement spine (SHOP-001/002, CAT-001, ACQ-001..003, COS-001, PLAT-001/002) in `.delivery/proposal.md`. This line is additive over the delivered `shoot4fun-login-profile/P1` surface: it never mutates or regresses shipped claims INT-001..INT-029.

**Gates already passed** (`REF-Delivery.md` §1): proposal accepted 2026-08-22 by Carlos Dias (`.delivery/proposal.md`, stamped); design approved 2026-08-21 by the operator over a passing fresh-eyes review (`.delivery/design.md`); plan closes over this handoff's passing fresh-eyes review (`.delivery/reviews/handoff-2026-08-22.md`) and is stamped by the operator before kickoff — the pre-flight refuses on any PENDING gate.

**Authorization.** The operator (Carlos Dias) authorizes this run to:

1. Push to this repo (`PSA-Department-of-Engineering/shoot4fun`): `main` (feature work via conventional commits) and the scratch ref `delivery/2026-08-21`.
2. No platform-repo actions: the app is already onboarded on the chaos install (`shoot4fun.chaos-architect.dev`, deploy branch `deploy-chaos`, promotion auto). No new grants are priced. CI publishing images to GHCR on push is in-grant.
3. No secret or infrastructure actions. No new credentials; the app's existing platform-minted database credential (`pg-app-shoot4fun`) is untouched.
4. No repo-host board actions (no milestones/issues creation required this run).

Executing the ship sequence in §8 end to end is in-grant without further enumeration.

**Not authorized** (restate verbatim in the §13 kickoff prompt):

- Monetization of any kind — no currency, pricing, purchases, cases, or gacha. Acquisition is a free unlock/grant only (recorded out-of-scope decision, `.delivery/proposal.md` scope notes).
- No writes to the estimation project (`shoot4fun-shop` on the estimatekit instance) — it is a legacy artifact; reopen read-only if history is needed.
- No onboarding/offboarding/pause/freeze of any app on the platform, no new hostnames, no identity-realm or event-bus grants (the app has neither).
- No scope beyond the P1 spine in `.delivery/proposal.md`: no 3D character viewer, no attachable-geometry or GLB cosmetic assets, no catalog CMS.

**Done-definition.** The run ends successfully when the §9 evidence chain is complete, every claim INT-030..INT-038 is active with a passing test, the full suite (pytest + vitest + Playwright e2e) is green with all previously-active claims still attested, and `csd-intent` audits CLEAN. It ends acceptably at a §10 degraded terminal state, evidence collected and reported plainly. There is no third way to end.

## 1. Inputs and references

| Input | Where |
|---|---|
| Verbatim customer request | `.delivery/request.md` (read-only ground truth) |
| Requirements + traceability | `.delivery/proposal.md` spine; estimation project slug `shoot4fun-shop` on the estimatekit instance (credentials from environment). Read-only legacy artifact. |
| Visual identity (locked) | `.delivery/design.md`; already landed in `docs/brand.md` + `docs/logo.svg` from the delivered line — the build **extends**, never re-invents: add the five-tier rarity legend (Common=outlined muted, Uncommon=secondary fill, Rare=primary fill, Epic=accent fill dark text, Legendary=primary-to-accent gradient dark text) as brand tokens where absent. The prototype (https://protopane.chaos-architect.dev/p/shoot4fun, screens `shop-catalog` / `shop-item-detail` / `shop-acquired` over its MCP) is a legacy reference. Behavioral surfaces the e2e claims assert (catalog→detail→acquired flow, back paths detail→catalog and catalog→arsenal) are the CLAIMS' contract (INT-030/031); design.md's interaction model agrees — on any disagreement the claims win. |
| Architecture and decisions | `docs/architecture.md`, `docs/adr/0001..0007` (ADR-0007 Arsenal envelope is load-bearing here); every deviation or new decision is an ADR authored before code |
| Intent claims | `intent.yaml` (this repo): INT-030..INT-038 draft; activate each as its test passes |
| Delivery lifecycle | `REF-Delivery.md` |
| Repo contract | `REF-Foundry.md` §4; enforced by this repo's shared CI (see §7) |
| Exemplar app(s) to mirror | This repo itself: mirror the delivered line's patterns (hexagonal backend routers/use-cases under `backend/shoot4fun_backend/`, per-claim test files, vendored `apps/client/e2e/intent-shim.ts`) |

## 2. Pinned decisions

| Decision | Value |
|---|---|
| Identity | Shoot4Fun / slug `shoot4fun` / namespace `shoot4fun` / hostname `https://shoot4fun.chaos-architect.dev` — existing, operator-confirmed (already onboarded; nothing to create) |
| Repo strategy | Retrofit, additive over the delivered line on `main`. Existing code and history untouched except additive changes; scratch rides `delivery/2026-08-21`. Shipped claims INT-001..INT-029 must stay green and attested. |
| Stack | Unchanged: FastAPI hexagonal backend (Python 3.11+), React 19 + Vite + Three.js client, zustand viewmodels. Rejected alternative: a separate shop microservice/database — rejected per assumptions DATA-001/CAT-001 (no separate shop DB, static authored catalog) and because the envelope writer must ride the existing account repository. |
| Backend / database | Existing `pg-app-shoot4fun`; Arsenal persists as JSONB through the account/Arsenal repository (ADR-0006 pattern + ADR-0007 envelope). **No schema migration** — growth lands inside the opaque `data` object under the reserved key conventions below. Without `DATABASE_URL` (local tests) the in-memory repository stands in, exactly as the delivered line's tests do. |
| App SSO (identity realm) | None — the app self-authenticates via its own session mechanism (`X-S4F-Session`, delivered line); the shop rides the same session context. No realm grant exists or is priced. |
| Registry visibility | Private GHCR under `ghcr.io/psa-department-of-engineering/` (org default; unchanged) |
| Language(s) | English |
| Security and data | Session-authenticated shop endpoints; acquisitions scoped per account (INT-037). No new secrets, no PII beyond what the delivered profile holds. Dependency-audit gate runs in CI on every push. |
| Quality bars | Accessibility: WCAG AA body text; known accepted gap inherited from design: white-on-orange small badges (~3.6:1) use the locked token pair — do not "fix" by inventing colors; surface at the acceptance demo. Rarity treatments follow the locked legend above (dark-on-gold/dark-on-gradient for accent/Legendary). Performance: no regression against the existing suites; no new runtime dependencies on the match path. Browser/device matrix: whatever `apps/client/playwright.config.ts` projects today (desktop browsers + the touch project), plus backend pytest. Content language English throughout. |
| Autonomy level | Full one-shot: the operator triggered the run and pre-authorized §0; never stop to ask (§10 is the only stop). |
| Data and licensing | Catalog: authored in-repo, committed at `backend/catalog/cosmetics.json` (exact source: this run authors ~8–12 items across all five rarity tiers; license: repo's own). Cosmetic rendering: material skins over the existing CharacterLibrary rig — **no new binary assets** (operator decision 2026-08-22 resolving RENDER-001). Previews render as token-styled swatches/gradients from the skin spec, not image files (closes the design phase's unpinned-preview finding). Logo/docs assets already committed. |
| Asset budget | Zero new binary assets this phase. If a swatch cannot express an item, simplify the item, not the budget rule. |

**Arsenal-envelope key conventions** (this line's additive growth per ADR-0007; write them into ADR-0008 before code). The delivered shape is `{ version: 1, data: { model: "robot", inventory: [] } }` and the Arsenal view already binds `data.inventory` (`apps/client/src/ui/viewmodels/arsenal/arsenal.state.ts`):

- Ownership record = an entry in `data.inventory`: `{ "id": "<catalog-item-id>", "acquired_at": "<ISO-8601>" }`. Presence in the collection IS ownership — no second source of truth, and acquisitions visibly populate the Arsenal the verbatim ask names. Legacy plain-string entries (none exist today) must not crash the join with catalog metadata.
- Equipped cosmetic = `data.loadout.cosmetic`: the item id of the currently equipped skin (absent = none). Note: a top-level `loadout` field exists in `accountApi.ts`'s `ArsenalView` type, but ADR-0007's preservation contract covers keys *inside `data`* only — write `loadout` inside `data`, never as a sibling of it; a top-level key would be silently dropped by round-trips.
- Both ride the envelope verbatim; older readers carry them untouched; `version` never changes. The shop never writes any other key.

## 3. Architecture (deviations become ADRs before code)

| ADR | Decision |
|---|---|
| ADR-0001..0005 | Match/net/simulation decisions — untouched, pointer to `docs/adr/` |
| ADR-0006 | Account model & session mechanism — reused as-is for PLAT-001 |
| ADR-0007 | Arsenal forward-compatible envelope — the persistence contract ACQ-002/PLAT-002 extend |
| ADR-0008 (new, author first) | Shop surface: static authored catalog (`backend/catalog/cosmetics.json`), `GET /api/shop/catalog`, `POST /api/shop/acquire`, ownership as `data.inventory` entries and equip as `data.loadout.cosmetic` (§2 conventions); hexagonal placement mirrors the account router/use-case/repository pattern |
| ADR-0009 (new, author if needed) | Any deviation discovered while building; otherwise omit |

Layout sketch (additive):

```
backend/
  catalog/cosmetics.json          # authored catalog (validated at load)
  shoot4fun_backend/
    domain/model/shop.py          # CatalogItem, rarity enum, ownership record
    application/use_cases/        # browse_catalog, acquire_item, equip_cosmetic
    adapters/inbound/http/routers/shop.py
apps/client/src/
  scene/cosmetics.ts              # shared applyCosmetic(instance, skinSpec) routine
  ui/views/molecules/RigView.tsx  # rig host carries data-equipped-skin from the routine
  ui/shop/                        # catalog grid, item detail, acquired screen (Acquired reuses RigView)
apps/client/e2e/shop.spec.ts      # INT-030/031/036 markers + an INT-034 marker on the
                                  # unlock journey asserting the Arsenal inventory lists the item
backend/tests/integration/test_shop_*.py   # INT-032..035/037/038 markers
docs/adr/0008-shop-surface.md
```

## 4. Data pipeline / integrations (exact sources)

n/a — no external datasets or integrations. The only data input is the hand-authored `backend/catalog/cosmetics.json` (license/attribution: repo's own, §2). No import step, so no import evidence is required in §9.

## 5. Requirements traceability

| REQ | Attested by |
|---|---|
| SHOP-001 | INT-030 |
| SHOP-002 | INT-031 |
| CAT-001 | INT-032 |
| ACQ-001 | INT-033 (+ UI journey inside INT-031/INT-036 specs) |
| ACQ-002 | INT-034 |
| ACQ-003 | INT-035 |
| COS-001 | INT-036 |
| PLAT-001 | INT-037 |
| PLAT-002 | INT-038 |

No requirement is descoped. Claim lifecycle: implement the test, see it pass, then activate the claim. All nine claims active is part of the done-definition; INT-001..INT-029 stay active and green throughout.

## 6. Build sequence

1. **Pre-flight** (abort only on a genuine wall, `exit 64`): Python venv + baseline `pytest -q` green from `backend/`; `npm ci` in `apps/client/` + `npm test` (vitest) green; Playwright browsers installed (`npx playwright install`); git push access to origin; estimatekit/protopane MCP reachability NOT required (all inputs frozen in the scratch and `docs/`). No local Docker needed (images build in CI on push).
2. **Land the visual identity**: verify `docs/brand.md` tokens equal `.delivery/design.md`'s block (they were locked byte-identical at the design gate); extend with the five-tier rarity legend where absent; confirm the frontend theme tokens consume the same values. The look is fixed before any shop surface is built.
3. **Author ADR-0008** (§2 key conventions + endpoint shapes), then the backend: catalog file + loader validation (INT-032), acquire/equip use cases over the account repository, shop router (session-gated), integration tests INT-033/034/035/037/038. Order matters: the envelope-preservation test (INT-038) runs against real acquire/equip writes, not mocks. Activate INT-034 only after step 4's e2e marker passes (its statement spans persistence and visible population).
4. **Client surfaces**: theme tokens → catalog/detail/acquired screens per the locked layout (whole-card links, Unlock on detail only, back paths; the Acquired screen reuses the `RigView` molecule to show the just-applied skin), the shared `applyCosmetic` routine in `src/scene/cosmetics.ts` consumed by `RigView` with the `data-equipped-skin` attribute on its host element, main-menu Shop tile wired — and correct the tile's caption copy (`menuConfig.ts` says "Skins, cases and cosmetics": "cases" names banned monetization, rewrite the caption without it); e2e specs INT-030/031/036 plus an INT-034 marker on the unlock journey (Arsenal inventory lists the acquired item).
5. **Adversarial review** (fresh-eyes, the `adversarial-review` skill): correctness, security, contract conformance vs ADR-0007 and the claims; fix every blocker, re-run tests.
6. **Local verification**: full pytest + vitest + Playwright suites green; `python -m csd_intent.cli .` CLEAN with INT-030..INT-038 activated; `tsc --noEmit && vite build` succeeds.

Commit style: Conventional Commits, coherent units, no co-author trailers.

## 7. Repo contract checklist

The shared CI is the authority; these are its observable gates:

- Conventional Commits, no `Co-authored-by:` trailers (the `commit-hygiene` gate blocks release otherwise).
- `devops/docker-compose.yml` remains the image source of truth (services `server`, `client`; docs derived from `docs/Dockerfile`); keep its `x-ref: devops/Dockerfile` intact. Known stale comment: the header says the docs image "is not listed here" while a `docs:` service is listed — correcting that comment in a passing commit is welcome; changing the service set is not.
- Version releases ride conventional-commit pushes (existing release train); do not hand-edit version pins.
- Keep the thin CI caller workflow and pre-commit config intact.

## 8. First-release and onboarding sequence (order is load-bearing)

No onboarding: the app is already declared and healthy on the chaos install (`role: output`, `promotion: auto`, `has_database: true`, `has_identity: false`). No grants this run. The released image set stays `{server, client, docs}` with the existing Image-Updater bindings writing `<name>.<component>.tag` on `deploy-chaos`.

Ship sequence: merge feature work to `main` with conventional commits → CI publishes `shoot4fun-{server,client,docs}` at the released version → Image Updater promotes tags onto `deploy-chaos` → ArgoCD syncs → probe (§9). There is no external IdP step (no SSO priced).

## 9. Verification: the evidence chain that means "live"

Collect ALL of these; a bare 200 proves nothing behind an edge cache:

1. CI green on the shipping commit on `main`.
2. GHCR packages `shoot4fun-server`, `-client`, `-docs` present at the released version.
3. Promotion visible in git: `deploy-chaos` carries the released image tags (Image Updater write-back commit).
4. Install reports the app synced/healthy at the released version (platform studio `app_status` or equivalent read).
5. Cache-busted probe of `https://shoot4fun.chaos-architect.dev` with freshness postdating the release — running pod image tag + start time, or a build-stamped commit/tag; a hardcoded version string does not count.
6. App-specific smoke: the shop journey (browse → detail → unlock → applied) exercised against the public URL, or the opt-in `e2e/foundry` suite with `SHOOT4FUN_HOST` pointed at it.

(No data import this run — no source/result counts to reconcile.)

## 10. Degraded stop-states (stop, collect, report; never loop, never claim live)

| Dependency down | Terminal state and required evidence |
|---|---|
| CI red on `main` after honest fix attempts | Stop on `main` red; attach failing workflow URL + last passing commit; local suites' green status; do not force-merge or skip gates |
| GHCR publish fails | Report workflow failure URL, versions attempted; nothing claims live |
| Promotion silent >30 min after release (no write-back commit on `deploy-chaos`) | Report pinned vs expected tags and the binding values paths; app may still be serving prior version — say which |
| Probe fails after ArgoCD reports synced/healthy | Bounded retry (3× over 10 min) for rollout lag, then stop: attach probe output, pod status, image tags; name CreateContainerConfigError-style secret causes if visible |
| Cluster/install unreachable | Report studio/API errors verbatim; local evidence only; nothing claims live |

## 11. Post-ship (in scope for the run)

1. No milestones/issues required this run (per §0.4); file none unless a §10 state demands a tracking artifact — then one issue, linked in the final report.
2. Explicitly NOT in scope: monetization/pricing model, cases/gacha/currency, 3D character viewer, GLB/attachable cosmetic assets, catalog CMS, the customer acceptance demo itself (operator's reserved act — the delivery gate closes on it, `REF-Delivery.md` §1).
3. Final report: evidence chain with URLs, the nine-claim table (active/test), plan defects encountered, and a customer demo blurb (live URL only in a fully-done end; a degraded end names where it WILL be live and says so plainly). Record the build-and-ship log in `.delivery/build.md`. Its last line tells the operator the next command: done-definition reached — demo against the claims table, stamp the delivery gate on acceptance, then `reconcile-delivery <repo-root>`; degraded — name the blocker and the action that clears it, then re-drive this phase.

> Degraded-then-fixed: a later authorized fix that takes the run live MUST re-arm skipped post-ship steps; reconcile-delivery re-checks and flags stale ones.

## 12. Evolution seed (do not build now)

- Monetization phase: currency, pricing, purchase flow over the same acquisition choke point (the proposal defers it explicitly).
- Cosmetic asset types beyond material skins: attachable geometry, authored GLB items (RENDER-001 revisit), preview art.
- 3D character viewer in the Arsenal panel (INT-027 placeholder).
- Catalog growth tooling (editor/CSV import) if the static file stops scaling.

## 13. Operator kickoff (trigger the run)

Primary form — invoke the builder skill in a fresh session (its mechanical pre-flight re-checks the §0 gates and refuses on any PENDING one):

> `/run-delivery-plan D:\Personal\shoot4fun`

Fallback — for an environment without the skill installed, the self-contained paste-blob:

> Execute `.delivery/handoff.md` in `D:\Personal\shoot4fun` end to end, autonomously. The authorization in the handoff §0 applies: push to `PSA-Department-of-Engineering/shoot4fun` (`main` + scratch ref `delivery/2026-08-21`), CI image publication to GHCR, no platform-repo actions, no new secrets. NOT authorized: monetization of any kind (currency/pricing/cases/gacha); writes to the estimation project; onboarding/offboarding/pause/freeze of apps, new hostnames, identity/event grants; scope beyond the P1 spine (no 3D viewer, no GLB/attachable assets, no CMS). Consult `.delivery/design.md`, `docs/` (the ADRs and the visual identity), `intent.yaml`, and the REFs the handoff references. Never stop to ask; if the handoff is silent, make the smallest reasonable choice and log it as a plan defect. Finish only at the §0 done-definition or a §10 degraded terminal state, then write the §11 final report and record it in `.delivery/build.md`.

> Fresh-eyes review passed 2026-08-22 (VERDICT: PASS; artifact `.delivery/reviews/handoff-2026-08-22.md`); recorded in `reviewed:`. The plan gate awaits its signer (REF-Delivery.md section 1).

> Gate closed: plan signed 2026-08-22 by Carlos Dias over a passing fresh-eyes review (REF-Delivery.md section 1). Prose above predates the closure.
