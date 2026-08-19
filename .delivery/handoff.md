---
phase: intent-plan
skill: intent-session
status: gate
gate: plan
signed: pending
reviewed: 2026-08-19
run: s4f-lp-001
attempt: 1
mode: interactive
started: 2026-08-19T17:46:34Z
finished: 
credential_ref: opencode-session
---

# handoff.md - shoot4fun (Login, Profile & Arsenal / P1)

This is the complete handover for an autonomous implementation run of the **P1 delivery line** (issue #41: Login, Profile & Arsenal) over the already-shipped shoot4fun product. It is assembled from the durable sources (`.delivery/proposal.md`, `.delivery/design.md`, `intent.yaml`, `docs/`) and adds only the run-scoped decisions below. It restates none of those; it points at them.

## 0. Mission, authorization, done-definition

**Mission.** Make opt-in login reachable, wire server-side profile preferences into the UI, and build the Arsenal view — the `arsenal` main-menu tile becomes functional and renders the player model and an inventory/loadout section. For whom: the shoot4fun players (issue #41). Verbatim request and requirement IDs live in the estimation project `shoot4fun-login-profile` (EstimateKit / PSA) and are carried, durably, into `.delivery/proposal.md` (spine LOGIN-001/002, PROF-001/002/003, ARS-001/002/003/004). This line delivers exactly that spine — one estimation phase, P1.

**Gates already passed** (`REF-Delivery.md` §1): proposal signed 2026-08-19 (`.delivery/proposal.md`); design approved 2026-08-19 (`.delivery/design.md`); plan signed <this run, below>.

**Authorization.** The operator pre-authorizes this run, under the standing autonomous-delivery profile, to:
1. Push to the shoot4fun repo (`main`, and a `delivery/shoot4fun-login-profile` branch that merges to `main` via the shared CI).
2. Reconcile the existing foundry app (no new manifest entry, no new namespace — the app is already onboarded and live at `shoot4fun.chaos-architect.dev`); no platform-repo manifest changes this line.
3. Use the existing per-app PostgreSQL database (`pg-app-shoot4fun`) already granted for identity/leaderboard; no new infrastructure grant.
4. Close repo issues/milestones for the deferred scope (shop, 3D viewer, weapon unlocks) as backlog seed, not as claims.

When the done-definition requires the app live, executing §8 end to end is in-grant: the app is already onboarded, so this means merging to `main` and letting the shared CI release — no wiring to stand up.

**Not authorized** (restate verbatim in §13): any change to the already-shipped shooter gameplay (match, weapons, leaderboard scoring, mobile input) or to the identity/auth model (INT-019/020/021/022); the shop surface, 3D player-model *rendering*, and weapon-unlock flows (explicitly out of scope per `.delivery/design.md`); any new foundry manifest entry, namespace, or hostname; any change to the repository's promotion contract or external repository targets; modifying or regressing `intent.yaml` claims INT-001…INT-022.

**Done-definition.** The run ends successfully when the §9 evidence chain is complete (CI green on the shipping commit, app live and probeable, new e2e specs green against the public URL) and the seven new claims in `intent.yaml` (INT-023…INT-029) are `active` with passing tests, while PROF-001/002 remain attested by the existing active `INT-021`. It ends acceptably at a §10 degraded terminal state, evidence collected and reported plainly. There is no third way to end.

## 1. Inputs and references

| Input | Where |
|---|---|
| Requirements + traceability | estimation project `shoot4fun-login-profile` (EstimateKit / PSA); read-only legacy. Durable spine in `.delivery/proposal.md`. |
| Visual identity (locked) | `.delivery/design.md`; already landed into `docs/` (brand page, logo asset, theme tokens). New surfaces inherit it verbatim — no new hue/font/shape (art direction, `.delivery/design.md`). |
| Architecture and decisions | `docs/adr/0001…0006` (identity = ADR-0006) and `docs/architecture.md`. ARS-004's envelope is new: **ADR-0007 authored by the build before code.** |
| Intent claims | `intent.yaml` (repo root); INT-023…INT-029 added this line; INT-021 carries PROF-001/002. |
| Delivery lifecycle | `REF-Delivery.md` |
| Repo contract | `REF-Foundry.md` §4/§5 (the app already conforms; no contract-file change this line). |
| Exemplar app(s) to mirror | the app's own landed code: `AccountPanel.tsx`, `account` viewmodels, `PlayerProfile`/`account_service.py`, `CharacterLibrary.ts`, `menuConfig.ts`. |
| Onboarding procedure | n/a: already onboarded (`foundry-onboard-app` historically done; `pg-app-shoot4fun` grant exists). |

## 2. Pinned decisions

| Decision | Value |
|---|---|
| Identity | name `shoot4fun`, slug `shoot4fun`, namespace `shoot4fun`, hostname `shoot4fun.chaos-architect.dev` — already confirmed live; this line does not rename or re-host. |
| Repo strategy | Retrofit / additive over the delivered product. Existing code stays; this line adds surfaces (AccountPanel mount, Arsenal view, reconciliation e2e, Arsenal data shape). No rewrite of shipped INT-001…INT-022 behaviour. |
| Stack | React 19 + TypeScript + Vite + Zustand (client); Python FastAPI (backend); Playwright e2e, vitest unit, pytest-intent. Rejected alternative: none — follows the shipped stack exactly. |
| Backend / database | Existing per-app PostgreSQL (`pg-app-shoot4fun`), already granted; PROF/ARS-004 data lands there via the existing `account_profiles` / a new forward-compatible Arsenal table. |
| App SSO (identity realm) | none — public shooter, self-auth via guest + recovery code (INT-019/020). Justified: public-by-design; no human-identity realm needed. |
| Registry visibility | public (GHCR under PSA-Department-of-Engineering); the release pipeline already builds/pushes client+server+docs images. |
| Language(s) | English UI content (matches shipped app). |
| Security and data | Guest + recovery-code auth (INT-019/020); preferences are non-sensitive player settings; dependency-audit gate via shared CI (`commit-hygiene` + audit workflows). No PII beyond a display name. |
| Quality bars | Same bar as the delivered app: WCAG AA token contrast, keyboard-operable controls via existing `Button`/`TextField`/`FormField`, `prefers-reduced-motion` honoured; browsers = the shipped matrix. Arsenal placeholder/empty-state copy legible at `muted-foreground`. |
| Autonomy level | Full one-shot build authorized (the claim set is bounded and additive over a live app — low-risk incremental feature); human gates pre-authorized where named in §10. |
| Data and licensing | The Arsenal player-model render reuses the already-committed `public/models/robot.glb` (loaded by `CharacterLibrary`); confirm its license/attribution beside the model in `public/models/` (README.md) during the build pre-flight (it is already in-repo and CC0, so licensing was settled at import — verify, do not re-license). |
| Asset budget | n/a: no new binary assets this line; the Arsenal view reuses the existing rig and token-driven UI. |

## 3. Architecture (deviations become ADRs before code)

| ADR | Decision |
|---|---|
| ADR-0006 | Optional player identity (guest + recovery code) — already landed; this line surfaces it, does not change it. |
| ADR-0007 (NEW, build authors) | Arsenal data shape: a versioned envelope that preserves unknown fields (forward-compatible per ARS-004). Established before the Arsenal view is coded. |

<layout sketch: this line adds no top-level entry. It (a) mounts `AccountPanel` into the menu/launch surface, (b) adds `apps/client/src/ui/views/pages/Arsenal.tsx` (or equivalent) rendering the `CharacterLibrary` rig + an inventory/loadout section bound to the ARS-004 shape, (c) flips the `arsenal` tile to `status: "ready"` in `menuConfig.ts`, (d) adds a backend Arsenal profile module + contract test for the forward-compatible envelope.>

## 4. Data pipeline / integrations

| Dataset / integration | Source (exact URL or endpoint) | Transform / notes |
|---|---|---|
| Player preferences (PROF) | `GET`/`PUT /api/account/profile` (already built; `PlayerProfile`: mouse sensitivity, touch sensitivity, master volume, SFX volume, haptics) | Client `settings.actions.ts` pushes on every setter (gated on `registered`) and pulls on sign-in. **Crosshair is NOT a synced field** (local HUD only this phase — documented descope). |
| Arsenal data (ARS-004) | New: `GET`/`PUT /api/account/arsenal` (or local-first) carrying the versioned envelope | Build defines schema + ADR-0007; contract test proves over-shaped payloads round-trip without loss. |

## 5. Requirements traceability

| REQ | Attested by |
|---|---|
| LOGIN-001 | INT-023 (draft → active at build) |
| LOGIN-002 | INT-024 (draft → active at build) |
| PROF-001 | INT-021 (existing, **active** — server-side profile store + clamp; mapped, not re-derived) |
| PROF-002 | INT-021 (existing, **active** — profile follows the account to any device; mapped) |
| PROF-003 | INT-025 (draft → active at build) |
| ARS-001 | INT-026 (draft → active at build) |
| ARS-002 | INT-027 (draft → active at build) |
| ARS-003 | INT-028 (draft → active at build) |
| ARS-004 | INT-029 (draft → active at build) |

Every requirement in the spine maps to at least one claim; no silent drops. PROF-001/002 already satisfied by the shipped `INT-021` (active, attested) — mapped rather than duplicated. The only documented descope is the word "crosshair" in `design.md`'s profile copy: crosshair is a local HUD visual, not a synced preference; the five synced preferences named in INT-021 are what PROF-001/002/003 cover this phase.

Claim lifecycle: implement the test, see it pass, then activate the claim (`status: active`). All INT-023…INT-029 active is part of the done-definition.

## 6. Build sequence

1. **Pre-flight** (abort only on a genuine wall): Node + package manager and Python available; git push access to the shoot4fun repo; the shared CI reachable. No local Docker needed (images build in CI). Backend tests default to the in-memory adapter; a local Postgres is optional (`TEST_DATABASE_URL`) — not a blocker. Confirm `robot.glb` licensing/attribution is recorded in `docs/`.
2. **Visual identity already in `docs/`** — render the new surfaces (account/profile/arsenal) with the same tokens from `apps/client/src/brand/theme.css`; no new hue/font/shape (art direction, `.delivery/design.md`). Adopt or drop the prototype's top-stripe gradient, but do not invent a treatment.
3. **Surface login (LOGIN-001/002 → INT-023/024):** mount `AccountPanel` into the menu/launch surface so register + sign-in are reachable but never required; confirm guests reach the match path and account failure degrades to offline. Add e2e markers `intent("INT-023", …)` / `intent("INT-024", …)` in `apps/client/e2e/account.spec.ts`.
4. **Profile reconciliation UI (PROF-003 → INT-025):** verify `pushToAccount` (on every setter, gated on `registered`) and `pullFromAccount` (on sign-in) form a converging loop; add e2e marker `intent("INT-025", …)` asserting local change → server → local-on-resign-in.
5. **Arsenal tile + view (ARS-001/002/003 → INT-026/027/028):** flip the `arsenal` tile to `status: "ready"` in `menuConfig.ts`; build the Arsenal view rendering the `CharacterLibrary` rig (placeholder panel until the 3D viewer lands) and an inventory/loadout section that renders gracefully empty, bound to the ARS-004 shape. Add e2e markers `intent("INT-026"/"INT-027"/"INT-028", …)` in `apps/client/e2e/arsenal.spec.ts`.
6. **Arsenal data shape (ARS-004 → INT-029) + ADR-0007:** author ADR-0007 (forward-compatible envelope, unknown-field preservation); implement the Arsenal profile module and a contract test `intent("INT-029", …)` (pytest-intent, integration) proving an over-shaped payload round-trips without data loss.
7. **Activate claims** as their tests pass (`status: active`).
8. **Adversarial review** (fresh-eyes, the `adversarial-review` skill): review the built software for correctness, security, and contract conformance; fix blockers and re-run.
9. **Local verification:** client unit + e2e (`npm test`, `npm run e2e`), backend pytest, and the `csd-intent` audit (the attestation gate: every active claim names a marker). A local container run is optional; CI is the authoritative image build.

Commit style: Conventional Commits, coherent units, no co-author trailers.

## 7. Repo contract checklist

The app already conforms to the foundry contract (`REF-Foundry.md` §4/§5): it has a `foundry.yaml` manifest entry, a `teams/shoot4fun/` folder, the `k8s/` Helm chart (client/server/docs deployments, services, httproute), and `docs/`. This line adds **feature code only** (client surfaces + backend Arsenal module) and changes **no contract file** — no new manifest entry, namespace, hostname, or image alias. The build's mechanical pre-flight re-checks conformance; if a touched file happens to regress a gate string, fix it before merge. The new backend Arsenal module follows the existing `account_service.py` / repository port pattern so it slots into the shipped contract unchanged.

## 8. First-release and onboarding sequence (order is load-bearing)

The app is already onboarded and live; no new grant this line. The released image set the promotion bindings already cover (client, server, docs). Sequence:
1. **Grants:** `foundry-onboard-app` — already done (historical). `foundry-onboard-database` — already done (`pg-app-shoot4fun` exists, used by INT-021). `foundry-onboard-keycloak` — n/a (no SSO this line). No new pull request this line.
2. **Released image set:** unchanged (client + server + docs), already bound.
3. **External step:** none (no SSO).

The build merges to `main`; the shared CI builds, pushes to GHCR, and the foundry reconciles — proven live per §9.

## 9. Verification: the evidence chain that means "live"

Collect ALL of these:
1. CI green on the shipping commit (the app's CI workflow; `commit-hygiene` must pass — no co-author trailers).
2. Registry artifacts at the released version (client/server/docs images in GHCR under PSA-Dep/... actually PSA-Department-of-Engineering).
3. Promotion visible in git (the deploy-branch image tag bump).
4. Orchestrator reports the app synced/healthy; pods running at the released version.
5. Cache-busted probe of `https://shoot4fun.chaos-architect.dev` returns 200 within 5s (INT-012's deployment evidence, already established).
6. App-specific smoke: the new e2e specs (`apps/client/e2e/account.spec.ts`, `apps/client/e2e/arsenal.spec.ts`) run in the same Playwright suite as `match.spec.ts` (root `e2e/`, against a locally-started server per the existing pattern), asserting login reachable-but-optional (INT-023/024), the arsenal tile opens the view (INT-026), and the inventory renders empty (INT-027/028). The public-URL liveness evidence is covered by INT-012's deployment probe (§9 item 5); the build does not need to relocate these specs under `foundry/**`.
7. `csd-intent` audit clean: INT-001…INT-029 active claims all name a marker; INT-023…INT-029 active after the build.

## 10. Degraded stop-states (stop, collect, report; never loop, never claim live)

| Dependency down | Terminal state and required evidence |
|---|---|
| Foundry cluster / app reconcile down | Stop. Evidence: CI green + images pushed, but probe fails / pods not synced. Report plainly; the run is degraded, not live. Operator clears the cluster and re-drives. |
| GHCR unreachable at release | Stop. Evidence: CI red on image push. Report; operator restores registry access. |
| `SHOOT4FUN_HOST` / external probe unavailable | Run completes CI + unit/integration; publish the §9 items 1–4,7 and mark the public-URL e2e (item 6) as skipped with reason. Not "live" — say so plainly; the deployment evidence (item 5) is the operator's to confirm. |
| Local Postgres absent for backend tests | Non-blocker: backend defaults to the in-memory adapter; `TEST_DATABASE_URL` opt-in only. |

## 11. Post-ship (in scope for the run)

1. Open backlog issues for the deferred scope (mapped from design.md out-of-scope): shop surface, 3D player-model rendering, weapon-unlock flows — seed, not claims.
2. Explicitly NOT in scope: the shop surface, 3D player-model *rendering* (the rig placeholder is in scope; the full viewer is not), and weapon-unlock flows. The customer demo is the operator's reserved step.
3. Final report: evidence chain with URLs, the claim table (INT-021 active + INT-023…INT-029 active), plan defects encountered (e.g. the AccountPanel-mount gap, the crosshair descope), and a customer demo blurb. Record the build-and-ship log in `.delivery/build.md`; its last line tells the operator the next command (`reconcile-delivery <repo-root>` on acceptance).

> Degraded-then-fixed: if the run stops at a §10 state and the operator later authorizes a fix that takes it live, re-arm the post-ship steps it skipped before reconcile.

## 12. Evolution seed (do not build now)

Backlog items (deferred per `.delivery/design.md`): shop surface (#41 follow-on), 3D character viewer for the Arsenal player-model panel, weapon-unlock + loadout persistence flows. Each becomes its own estimation phase; this line's Arsenal data shape (ARS-004 / ADR-0007) is built to absorb them without a breaking change.

## 13. Operator kickoff (trigger the run)

Primary form - invoke the builder skill in a fresh session (its mechanical pre-flight re-checks the §0 gates and refuses on any PENDING one):

> `/run-delivery-plan D:\Personal\shoot4fun`

Fallback - for an environment without the skill installed, the self-contained paste-blob:

> Execute `.delivery/handoff.md` in `D:\Personal\shoot4fun` end to end, autonomously. The authorization in the handoff §0 applies: push to the shoot4fun repo (delivery branch → main via shared CI), reconcile the already-onboarded foundry app, use the existing `pg-app-shoot4fun` database. NOT authorized: any change to shipped shooter gameplay or the identity/auth model (INT-001…INT-022), the shop/3D-viewer/weapon-unlock scope, any new foundry manifest entry/namespace/hostname, or modifying intent.yaml claims INT-001…INT-022. Consult `.delivery/design.md`, `docs/` (ADRs + visual identity), `intent.yaml`, and the REFs the handoff references. Never stop to ask; if the handoff is silent, make the smallest reasonable choice and log it as a plan defect. Finish only at the §0 done-definition or a §10 degraded terminal state, then write the §11 final report and record it in `.delivery/build.md`.

> Fresh-eyes review passed 2026-08-19 (VERDICT: PASS; artifact `.delivery/reviews/handoff-2026-08-19.md`); recorded in `reviewed:`. The plan gate awaits its signer (REF-Delivery.md section 1).
