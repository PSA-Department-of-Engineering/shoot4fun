---
phase: intent
skill: intent-session
status: complete
gate: plan
signed: 2026-07-28
reviewed: 2026-07-28
run: shoot4fun-2026-07-28
attempt: 1
mode: interactive
started: 2026-07-28T00:00:00Z
finished:
credential_ref: csd-intent-mcp,protopane-mcp,estimatekit-mcp,platform-studio-mcp
---
# Build handoff — shoot4fun

> **What this is.** The one-shot build handoff per `REF-Delivery.md` §4b.
> An autonomous build reads this file and nothing else from the
> scratch; every question the build could ask has its answer written
> down or pointed to. The handoff is the contract between intent and
> the build run. It does not restate the durable sources — it points
> at them — and it is deleted at reconcile (§1 of REF-Delivery).
>
> **Source artifacts (the durable homes this handoff points at).**
>
> | Source | Where | What it carries |
> | --- | --- | --- |
> | The estimation project | `https://estimatekit.chaos-architect.dev` (slug `shoot4fun`) | 17 Req IDs, the BRD, the roadmap, the Excel workbooks, the deck, the audit (90/0/0) — immutable; never copied into the repo (`REF-Delivery.md` §1) |
> | The proposal record | `.delivery/proposal.md` | The 17 Req IDs the engagement priced, the resource plan, the descope list, the operator §4b decisions, the 11 estimatekit assumptions; signed 2026-07-28 |
> | The visual identity | `.delivery/design.md` (and once landed, `docs/brand.md` + `docs/logo.svg` + `docs/logo-monogram.svg`) | The locked brand theme (full 19-key shadcn set), the typography stack, the arena dimensions, the HUD chrome, the interaction model, the accessibility bar; signed 2026-07-28 |
> | The intent spec | `intent.yaml` at the repo root | 17 claims, one per Req ID, each with `derived_from`, `rationale`, `test { scope, component, type }`, `criticality`, `status: draft`; this handoff's correctness spine |
> | The audit | `python -m csd_intent.cli .` | Schema + orphan + coverage; clean at handoff write (17 claims, 17 attested) |
> | The design prototype (legacy) | `https://protopane.chaos-architect.dev/p/shoot4fun` (reachable via `protopane_get_project`) | The locked brand theme + the prototyped DOM surfaces (`lobby`, `results`, `settings`); the 3D scene is prose in `design.md` §2, not a prototype |

## 0. Contract anchors (mechanical preflight)

The three inline bold-anchor labels the run-delivery-plan preflight script
checks for, pointing at the sections that carry the substance. Added at the
build phase as a mechanical-format fix; the substance is unchanged.

**Authorization**: see §3 (architecture / image shape — two-image
`onboard_app(name="shoot4fun", image_components=["server", "client"], expose_mcp=False)`),
§10 (run mode and authorization overrides), and §17.3 (what the build may
push, merge, apply, touch). Pre-authorized: commits to `main` on the app
repo; opening (never merging) the platform onboarding PRs
(`foundry-onboard-app`, `foundry-onboard-database`); the per-app credential
Job writing secrets in-cluster (`pg-app-shoot4fun` mints on the platform,
ADR-034); the build's Helm chart values via the image-updater write-back
(never an in-hand chart pin edit). **Nothing else is authorized**.

**Not authorized**: see §16 — descoping a priced requirement, merging a
platform PR, signing a delivery gate by hand, re-opening a downstream gate,
editing the estimation project, force-pushing, committing secrets, running
untrusted code from build-time LLM output, inventing a colour / font / asset
outside the locked visual identity, or waiting for a human beyond the named
human gates in §11. **Nothing else is authorized**.

**Done-definition**: see §13 — the app is verified live, evidenced by the
full seven-link chain: (1) CI green on `main`, (2) GHCR `shoot4fun-server`
and `shoot4fun-client` images at the new tag, (3) promotion write-back
visible on the deploy branch (`<app>.images.<component>.tag`), (4) cache-busted
HTTPS GET of `shoot4fun.chaos-architect.dev` returns 2xx with response
headers postdating the release, (5) per-app `platform-studio app_status
shoot4fun` reports every link as `ok`, (6) `has_database: true` and
`has_identity: false` (identity is descoped — `false` is the intended state),
and (7) every `intent.yaml` claim is `status: active` after the per-claim
tests pass. **Nothing else is done**.

**Degraded stop-states**: see §14. A wall is the only thing that stops the
run; everything else loops to green.

## 1. Identity

| Field | Value |
| --- | --- |
| Name | Shoot4Fun |
| Slug | `shoot4fun` |
| Customer | Self (Carlos Dias) — self-serve, single operator signs all four gates |
| Target hostname | `shoot4fun.chaos-architect.dev` |
| Repo | `https://github.com/PSA-Department-of-Engineering/shoot4fun` |
| Local path | `D:\Personal\shoot4fun` |
| Maintainer-confirmed | yes (proposal §4b; the operator is the customer) |

## 2. Repo strategy

**Greenfield.** The repo currently holds the design assets (`docs/logo.svg`, `docs/logo-monogram.svg`) and the proposal scratch; no application code exists. The build scaffolds from `bootstrap-hexagonal-backend` (Python/FastAPI/uvicorn, hexagonal layers, asyncio tick), `bootstrap-threejs-app` (Vite + TypeScript + Three.js, the SceneApp module shape, optional Playwright SwiftShader e2e), and the intent runtimes `bootstrap-pytest-intent` + `bootstrap-playwright-intent`. App-repo contract conformance (`REF-Foundry.md` §4) is wired at scaffold time, not retrofit, per `REF-Delivery.md` §5a.

The intent claim stubs under `tests/intent/` are plan-time placeholders; the build ports them into the per-module test trees as it scaffolds the test frameworks:

- `backend/tests/` — Python claims (INT-005 unit + e2e, INT-008, INT-009, INT-010 unit, INT-011 unit + e2e, INT-012 evidence-chain, INT-017)
- `apps/client/e2e/` — Three.js / Playwright claims (INT-001, INT-002, INT-003, INT-004, INT-006, INT-007, INT-010 e2e, INT-011 e2e, INT-013, INT-014, INT-015, INT-016)
- `e2e/foundry/` — the deployment-evidence claim (INT-012); this is a third test tree, separate from the backend and the client, because INT-012's contract is the live platform + the public URL + the per-app conformance, not the backend or the frontend in isolation. The build creates `e2e/foundry/deployment.spec.ts` here.

## 3. Architecture

**Pointer.** Architecture decisions land in `docs/architecture.md` and the first ADR in `docs/adr/0001-…md` as a build-exit criterion (`REF-Delivery.md` §5a). The handoff does not restate the architecture; the proposal attempt 2 revision pinned the technology choices (Python/FastAPI/uvicorn backend, asyncio tick, asyncio.Lock for shared state, Three.js frontend) and the build's ADRs are the maintained form.

The build's first ADR captures the WebSocket-server-authoritative decision (ARCH-001) and the FastAPI/uvicorn choice with a `bootstrap-hexagonal-backend`-mirror rationale. The architecture page in `docs/` lists the components (per the estimatekit's `P1-components.tsv`: WebSocket Server, Authoritative Tick Loop, Match State Machine, Scoring/Leaderboard, Frontend Scene, HUD Overlay, DOM Lobby/Results/Settings).

**Image shape (the build's onboarding call).** The platform's `onboard_app` takes `image_components`; for two workloads the call is `onboard_app(name="shoot4fun", display_name="Shoot4Fun", description="A simple multiplayer Three.js shooter", icon="mdi-crosshairs", image_components=["server", "client"], expose_mcp=False)`. `expose_mcp: false` is pinned: a multiplayer game has no LLM-facing surface and no MCP story; the build does not re-decide this. The `mdi-crosshairs` icon is the brand's lockup mark from `docs/logo-monogram.svg`; the platform's icon vocabulary accepts any `mdi-*` name, the build does not invent one. The two packages are `ghcr.io/PSA-Department-of-Engineering/shoot4fun-server` (FastAPI/uvicorn, Python 3.11+) and `ghcr.io/PSA-Department-of-Engineering/shoot4fun-client` (Vite-built static served by nginx or caddy). The platform's image-updater writes the tags back to the deploy branch as `<app>.images.server.tag` and `<app>.images.client.tag`. Per-app RBAC and the per-app Gateway are rendered for the namespace `shoot4fun`.

## 4. Visual identity

**Pointer.** The visual identity is locked at `.delivery/design.md` (signed 2026-07-28). The build lands it into the durable homes:

- `docs/brand.md` — the brand page, the full 19-key shadcn token set, the typography stack, the logo assets, the rasterisation strategy (`design.md` §1.1, §1.2, §1.3, §1.4)
- `docs/logo.svg` and `docs/logo-monogram.svg` — the wordmark + crosshair lockup and the monogram, both already committed
- `README.md` — replaced from the existing 2-line stub with one that has `<img src="docs/logo.png" alt="Shoot4Fun">` as the header (per `design.md` §1.4 "R" line); the PNG is rasterised from the SVG via the same resvg path the favicon uses
- The frontend's theme tokens read the same HSL values from the brand page; the 3D scene reads the same HSL values into `THREE.MeshStandardMaterial.color`
- The favicon, the apple-touch-icon, the PWA icons (192, 512) rasterise from `docs/logo-monogram.svg` via `@resvg/resvg-js` with the WOFF2 fonts passed in the build context (per `design.md` §1.4)

**LDR-002 (P2) UI treatment — pinned at the plan gate.** The persistent best-score leaderboard's UI is **not yet designed** per `design.md` §2.3 ("deferred to a P2 design pass"). The build's P2 default is the per-match-results treatment, scaled out: a list of (arena → top score, holder initials, date) rows in the same `Inter 16px` rows the per-match results use, with the 1st-place row carrying the `--brand` background and `--brand-fg` text, reachable from a "LEADERBOARD" tab in the lobby and from the results page. This is the build-time default; a future P2 design pass may refine the treatment, but the per-match-results pattern is the floor the build lands so the claim is attestable at `LDR-002` test time. The build's exit criteria do not require a locked LDR-002 design pass before `LDR-002` is implemented; the implementation is the floor, the design is a follow-on.

The build is forbidden from inventing a colour. A non-token colour anywhere in the build is a defect (`design.md` §1, "A non-token colour anywhere in the build is a defect").

## 5. Data and licensing

| Item | Source | License | Committed vs fetched | Notes |
| --- | --- | --- | --- | --- |
| Wordmark + crosshair lockup | original (`docs/logo.svg`) | MIT (proposal §4b) | committed | the primary brand mark; rasterised to `docs/logo.png` for the README header |
| Monogram (favicon) | original (`docs/logo-monogram.svg`) | MIT | committed | favicon, PWA tile, any compact context |
| Self-hosted fonts (Russo One, Bungee, Inter, JetBrains Mono) | Google Fonts | OFL | committed as WOFF2 in `apps/client/public/fonts/` | no `@import` from Google Fonts at runtime; the build self-hosts all four |
| 3D geometry | procedural (`THREE.*Geometry`) | n/a | generated at runtime | no GLTF, no external models, no textures |
| Sound | generated at runtime (Web Audio API) | n/a | n/a | no audio files in the repo |
| Backend code | original | MIT | committed | the build is original; no third-party copy-paste |
| Frontend code | original | MIT | committed | same |
| Estimatekit data (BRD, roadmap, workbooks) | estimatekit instance | n/a (engagement artifact) | NOT in this repo | legacy artifact, lives in the estimation project |
| Protopane project (DOM screens) | protopane instance | n/a (engagement artifact) | NOT in this repo | legacy artifact, reachable via `protopane_get_project` |

No third-party models, no third-party textures, no third-party audio. The brand is original; the only external assets are the four self-hosted Google Fonts (OFL).

## 6. Content language

English (proposal §4b; the customer's request was in English, the brand is wordmark + palette, all UI strings are English).

## 7. Security and data model

**Public-by-design (per proposal §4b).** The app holds no PII (no accounts, no login, no analytics IDs), no secrets (no API keys, no credentials, no tokens), and the leaderboard stores the highest per-arena score keyed by the PSA-database role, not by player identity. The security model is the "no sensitive data" model:

- No identity realm. The proposal's `§"What the verbatim ask does NOT cover"` records identity as descoped.
- No app-database credential in the operator's hands. The `pg-app-shoot4fun` credential mints in-cluster (`REF-Foundry.md` §5, ADR-034) and the platform's onboarding studio's database grant is the only path that creates it; the build does not author credentials.
- The WebSocket match room is the only place player data flows. A player's `player_id` is a server-issued UUID per match, not a persistent identifier. The leaderboard is owned by the `pg-app-shoot4fun` database role, but the data inside is keyed by arena name (one row per arena) — the role is the storage principal, not a data key.
- The dependency-audit gate (pip-audit / npm-audit) is the standing check for known CVEs. It is a **build-time CI step** on every PR, not a per-claim attestation — it gates the image-publish step rather than living on a claim. Pin transitive versions, run the audit on every dependency update, no `latest` pins.

## 8. Quality bars

| Bar | Floor |
| --- | --- |
| Accessibility (design §4) | HUD number ≥ 24px Bungee; HUD secondary text ≥ 14px Inter; crosshair contrast 4.5:1 against any arena; team distinction = colour + shape (T1 circle, T2 triangle on the capsule); audio cues paired with visuals; `M`/`S` mute toggles + `localStorage` persistence; pointer-lock failure degrades to keyboard-look |
| Performance | 60fps on a mid-range desktop GPU (per design §1.2 build note); no postprocessing in MVP (per INT-016 rationale); one hemisphere + one directional light; **[P2]** basic shadow map (INT-016 — MVP has no shadow map per the VFX-002 split in the proposal) |
| Browser matrix | modern evergreen (Chrome, Edge, Firefox, Safari current) — `QA-001` in the assumptions; mobile/touch is descoped (proposal §"What the verbatim ask does NOT cover") |
| Visual identity | every UI element reads the brand tokens; no non-token colour anywhere; the wordmark is rendered with the locked fonts |
| Content language | English |
| License | MIT |
| Dependency audit | pip-audit + npm-audit clean on the `shoot4fun` image builds |

A "best-effort" bar applies where noted (per proposal §4b "Quality bars: best-effort; browser matrix = modern evergreen"). The accessibility bar above is the one hard floor the design fixed.

## 9. Test surface (per-claim attestation)

The 17 claims attest at the layer the build's exit criteria verify them at. Plan-time test stubs under `tests/intent/` (Python backend claims at `tests/intent/test_intent_claims.py`, Playwright e2e/client claims at `tests/intent/intent_claims.spec.ts`) carry the `@intent("INT-NNN")` / `intent("INT-NNN", ...)` markers; the build ports them into the per-module test trees and replaces the bodies with real tests.

| Req | Claim | Test scope | Test surface | Build target file |
| --- | --- | --- | --- | --- |
| REN-001 | INT-001 | e2e | Playwright: WebGL canvas mounts and a live frame presents within 2s | `apps/client/e2e/scene.spec.ts` |
| CAM-001 | INT-002 | e2e | Playwright: pointer-lock + mouse-move rotates camera; pitch is clamped | `apps/client/e2e/camera.spec.ts` |
| MOV-001 | INT-003 | e2e | Playwright: WASD changes player position; released keys stop motion within one server tick | `apps/client/e2e/movement.spec.ts` |
| SHO-001 | INT-004 | e2e | Playwright: click fires equipped weapon; target HP decrements | `apps/client/e2e/combat.spec.ts` |
| HP-001 | INT-005 | unit | pytest: `PlayerHealth` clamps at 0, respawn resets to `max_hp`; e2e: respawn lifecycle | `backend/tests/unit/domain/test_player_health.py`, `apps/client/e2e/respawn.spec.ts` |
| MAP-001 | INT-006 | e2e | Playwright: scene graph contains one ground plane + 6–8 cover blocks per design §2.1 | `apps/client/e2e/arena.spec.ts` |
| COL-001 | INT-007 | e2e | Playwright: player cannot pass through wall/cover; two clients cannot occupy the same point | `apps/client/e2e/collision.spec.ts` |
| NET-001 | INT-008 | integration | pytest TestClient: WS room accepts 2–4, rejects 5th with `ROOM_FULL` | `backend/tests/integration/test_match_room.py` |
| SYNC-001 | INT-009 | integration | pytest TestClient: server-authoritative replication, tick rate at 20Hz | `backend/tests/integration/test_authoritative_tick.py` |
| SCO-001 | INT-010 | unit | pytest: `KillCounter.record_kill` increments; e2e: win-condition | `backend/tests/unit/domain/test_kill_counter.py`, `apps/client/e2e/match_end.spec.ts` |
| MAT-001 | INT-011 | unit | pytest: `MatchStateMachine` transitions; HP changes only in `playing` state; e2e: lifecycle | `backend/tests/unit/domain/test_match_state_machine.py`, `apps/client/e2e/lifecycle.spec.ts` |
| DEP-001 | INT-012 | integration | cache-busted HTTPS GET of `shoot4fun.chaos-architect.dev` returns 2xx (or 302/401); platform `app_status` / `run_conformance` is green | `e2e/foundry/deployment.spec.ts` |
| WPN-002 | INT-013 | e2e | Playwright: two weapons selectable via `1`/`2`; stats differ | `apps/client/e2e/weapons.spec.ts` |
| MAP2-002 | INT-014 | e2e | Playwright: lobby exposes ≥2 maps, host picks one, server loads it, client renders it | `apps/client/e2e/map_select.spec.ts` |
| SND-002 | INT-015 | integration | Playwright: Web Audio analyser sees gunshot, hit, footstep envelopes; lobby horn on `lobby -> playing`; results sting on `playing -> results`; volumes from `localStorage` | `apps/client/e2e/audio.spec.ts` |
| VFX-002 | INT-016 | integration | Playwright: muzzle flash + hit particles live in scene; one shadow-map pass, zero postprocessing | `apps/client/e2e/vfx.spec.ts` |
| LDR-002 | INT-017 | integration | pytest: `LeaderboardRepository` reads/writes per-arena best score; persists across fixture teardown; only highest retained | `backend/tests/integration/test_leaderboard_repository.py` |

**Untestable, and how it's handled instead.** Three claims have a soft floor:

- **INT-002 (pitch clamp)** — the clamp is a single-line value; e2e is the only way to verify the *feel*. A manual acceptance note is acceptable if the e2e proves the limit is enforced (the assertion itself is the floor).
- **INT-015 (audio envelope)** — the Web Audio analyser test is sufficient for the *node fires* contract; perceived loudness/timbre is a manual best-effort (per proposal §4b "best-effort").
- **INT-016 (postprocessing chain)** — the assertion is "no FXAA, no bloom"; this is testable, the soft floor is the absence of a regression (no postprocessing pass added later without re-running the claim).

The audit (`csd-intent .`) attests every claim with at least one marker. The build promotes claims to `status: active` as their tests pass; the delivery gate's acceptance demo (`REF-Delivery.md` §5) reads the active claims.

## 10. Run mode and authorization overrides

| Field | Value |
| --- | --- |
| Mode | `interactive` (proposal `run` field) — the build run is `interactive` here too; the four phases after Scope run in fresh sessions joined by artifacts, not memory |
| Interaction (launcher flag, not persisted) | `manual` (default for a terminal driver) — the operator signs the plan gate, the build can ask the operator at named human gates, and the operator runs the delivery-gate acceptance demo. Per `REF-Delivery.md` §1, `interaction` is the launcher's per-invocation flag and is not persisted in the scratch; a later phase that resumes in an automated pod runs `auto` regardless of what the scratch says. |
| Standing autonomous-delivery profile | none — no pre-authorized gates; every named human gate requires the operator at the terminal |
| Run mode override | none |
| Assumption protocol (`REF-Delivery.md` §4b) | not applicable in interactive mode — the build asks, the operator decides, the journal records the decision |

## 11. Manual human gates (pre-authorized or flagged)

| Gate | Pre-authorized? | Notes |
| --- | --- | --- |
| Plan gate (this handoff) | awaiting operator signature | this handoff is the artifact; the operator confirms the gate close |
| Git push of the plan record | yes | the proposal/design commits pushed; the build's per-commit push is part of the handoff contract (`REF-Delivery.md` §1, "Each phase commits its record and pushes it") |
| Git push of the build's commits | yes | per `REF-Delivery.md` §5a "Commit and push in coherent units through the build" — the operator's standing authorization at handoff read |
| `foundry-onboard-app` PR merge | no | per `REF-Foundry.md` §5, the platform repo's CI admits the PR moments after it opens (ADR-036); the build never merges it, the operator does not either — the run polls it to merged |
| `foundry-onboard-database` PR merge | no | same |
| Image-updater freeze/resume | no | only triggered by an operator decision recorded at the engagement board (`REF-Delivery.md` §5) |
| App pause/resume | no | only triggered by an operator decision (lifecycle toggle) |
| Delivery-gate acceptance demo | awaiting operator + customer (here: operator) | the demo runs against the active claims; the operator signs the delivery gate |

## 12. External dependencies and pre-flights

| Dependency | Pre-flight (build must run before first use) | Degraded stop-state if down |
| --- | --- | --- |
| GitHub Container Registry (`ghcr.io/PSA-Department-of-Engineering`) | `docker login ghcr.io` confirms auth; the build's `ci-caller` workflow has `packages: write` | the image-publish step fails the build; the build stops with a non-zero exit on first push attempt; no degraded live state (the image must be in the registry to ship) |
| PSA Foundry cluster (the `platform-studio` MCP) | `platform-studio list_apps` returns the install manifest; `shoot4fun` appears in the listing once the platform CI admits the onboarding PR (ADR-036), not when the PR opens. The platform's target revision is `deploy-chaos` (every running app per `list_apps` carries `target_revision: deploy-chaos`); the onboarding PR is based against it. | the onboarding PR cannot be opened; the run stops degraded at the platform PR step (`REF-Delivery.md` §5b, "the one thing that deliberately stops and waits for a human") |
| PSA Foundry per-app database (the `pg-app-shoot4fun` role) | `platform-studio get_app shoot4fun` reports `manifest.has_database: true` once the `foundry-onboard-database` PR merges and the credential Job runs (the `app_status` tool reports the evidence-chain links — onboarded, app_repo, ci, promotion, credentials, probe — not a `has_database` field; `get_app` is the source for the manifest itself) | `LDR-002` cannot be attested; the run stops degraded, the operator unblocks the database grant (or descopes `LDR-002` — but descope of a priced P2 capability is a degraded stop per `REF-Delivery.md` §5b) |
| Per-app image-pull secret reflected into the namespace | `kubectl get secret -n shoot4fun` shows the ghcr-pull secret mirrored; if `ImagePullBackOff`, wait + re-check (the reflector mirrors it on its own per `REF-Foundry.md` §3) | wait it out, re-check; not a wall |
| Resvg (rasteriser for the favicon / PWA icons / README header) | `npm ls @resvg/resvg-js` in the build's frontend dir; the fallback (convert `<text>` to `<path>`) is in the design's `design.md` §1.4 | the build falls back to the `<text>`→`<path>` conversion; no wall |
| Google Fonts WOFF2 files (Russo One, Bungee, Inter, JetBrains Mono) | the build downloads the four WOFF2 files at scaffold time from Google Fonts' static CDN, commits them to `apps/client/public/fonts/`; no runtime Google Fonts import | the favicon rasterises with a font fallback (the build's path is pinned to resvg + font-file; the fallback is the `<text>`→`<path>` conversion) |
| CSD intent CLI (plan-time audit only; the build wires the per-module `pytest-intent` / `playwright-intent` runtimes) | `python -m csd_intent.cli --version` reports `0.3.0`; install spec is `pip install "csd-intent @ git+https://github.com/PSA-Department-of-Engineering/csd-library.git@csd-intent-v0.3.0#subdirectory=csd-intent"` (per the `audit-intent` skill) | the build's per-claim attestation cannot be verified; the run stops degraded with a clear message ("csd-intent not installed; install per the audit-intent skill") |
| Playwright browsers (for INT-001 … INT-016 e2e tests) | `npx playwright install --with-deps chromium` in the build's frontend dir | the e2e tests cannot run; the build stops with a clear message; local-dev workaround: `npx playwright install` (no --with-deps) |

## 13. Verification evidence chain

The build's done-definition per `REF-Delivery.md` §5a/§5b is not "the build ran" — it is **"the app is verified live"**. The chain is:

1. **CI green on the app repo's default branch.** The `ci-caller` workflow completes `success` on the commit the build promoted to `main`.
2. **Artifacts published at the new version.** GHCR carries the `server` and `client` images at the new tag; the platform's image-updater writes that tag back to the deploy branch (`<app>.images.<component>.tag`).
3. **Promotion write-back visible in git.** The deploy branch's `<app>.images.<component>.tag` field is the new version, with a write-back commit by the image-updater (auto-promotion is on per `PLAT-001`).
4. **Cache-busted probe of the public URL.** A fresh `curl -H "Cache-Control: no-cache" https://shoot4fun.chaos-architect.dev` returns 200 (or 302/401 if OIDC is ever added — but identity is descoped, so 200) within 5s, with response headers postdating the release. No plain 200 — the chain is freshness, not just liveness.
5. **Per-app conformance report is green.** `platform-studio app_status shoot4fun` reports every per-app row as `ok` (the `onboarded`, `app_repo`, `ci`, `promotion`, `credentials`, `probe` links). The credentials link is the standing explanation for a probe that does not answer (`CreateContainerConfigError`).
6. **Priced capabilities are bound, not absent.** `has_database: true` (the per-app `pg-app-shoot4fun` grant), `has_identity: false` (identity is descoped — `false` is the intended state, not a gap). A `has_database: false` when `LDR-002` is priced is a **degraded stop**, not "live", per `REF-Delivery.md` §5b.
7. **Per-claim attestation.** `python -m csd_intent.cli .` reports `CLEAN` with every claim `status: active`; the build promotes each claim from `draft` to `active` as the corresponding test passes.

The build writes this chain to `.delivery/build.md` as the build-and-ship log; the delivery gate's acceptance demo reads it.

## 14. Degraded stop-states

The run stops degraded (worker `exit 64`, handoff frontmatter `status: aborted`) on:

| Trigger | Why it's a wall | What the operator sees |
| --- | --- | --- |
| GHCR push fails (auth, network) | the image must be in the registry to ship | "image publish failed; check `docker login ghcr.io` and the build's `GITHUB_TOKEN`" |
| `platform-studio` MCP unreachable | the platform PR cannot be opened | "foundry unreachable; check the platform studio URL" |
| `foundry-onboard-app` PR is refused by the platform CI's own conformance | the platform's own admission gate failed; the build has nothing more to do | "platform conformance refused the onboarding PR; the run stops degraded" |
| `pg-app-shoot4fun` credential Job fails or never mints | `LDR-002` cannot attest; descope of a priced P2 capability is not a smallest-reasonable assumption | "per-app database credential did not mint; check `platform-studio get_app shoot4fun` (the `manifest.has_database` field is the source of truth, not `app_status`) and `app_status shoot4fun`'s `credentials` link. `LDR-002` is priced — descope would be a delivery failure" |
| `csd-intent` cannot be installed (Python 3.11+ venv not available) | the audit cannot attest the spec | "csd-intent missing; install per the `audit-intent` skill (`pip install "csd-intent @ git+https://github.com/PSA-Department-of-Engineering/csd-library.git@csd-intent-v0.3.0#subdirectory=csd-intent"`)" |
| Playwright browsers cannot be installed on the build's runner | e2e cannot attest INT-001 … INT-016 | "playwright install failed; the e2e tests cannot run" |

The run does **not** stop on `ImagePullBackOff` (wait + re-check per `REF-Delivery.md` §5b), an ArgoCD sync still settling (wait), or a transient GHCR 5xx (retry to budget). These are the worker's `exit 0` loop's job, not a degraded stop.

## 15. Post-ship scope (what the build does NOT do)

The build is shipped when the evidence chain (§13) is complete. The build's surface stops at:

- The 17 Req IDs in the proposal's Phase 1 + Phase 2. No Phase 3 features.
- The descope list (proposal §"What the verbatim ask does NOT cover") is the build's negative scope: no identity, no chat, no anti-cheat beyond server-authoritative, no persistent profiles, no mobile, no matchmaking queue, no spectator UI, no map editor, no region selection, no monetisation.
- The first release opens the evolution loop; the build does not create the project board (`REF-Delivery.md` §6 — the operator creates the tracking surface after first ship).
- The build does not write `.delivery/build.md` beyond the evidence chain (§13) and the acceptance link.

## 16. Not-authorized list (the run may NOT do these)

This is the explicit list of actions the build is forbidden from taking. The handoff's authorization (§10) does not extend to these; the run stops and surfaces them to the operator, even under `interaction=auto`.

1. **Descope a priced requirement mid-build.** `LDR-002`'s priced platform capability (the `pg-app-shoot4fun` database grant) cannot be descoped in favour of an in-memory store; `INT-001` … `INT-017` cannot be descoped in favour of "ship a smaller version". A descope is a delivery failure, not a smallest-reasonable assumption (`REF-Delivery.md` §5b).
2. **Merge any platform PR itself.** The platform repo's CI admits the onboarding PR (ADR-036); the build polls it to merged. A hand-merge is forbidden; a `gh pr merge --auto` is forbidden.
3. **Sign a delivery gate by hand.** The `signed:` field is the gate helper's (`stamp_gate.py` / `close_gate.py` / the design phase's stamper) alone; the build never writes `signed:` and never offers to sign a pending gate (`REF-Delivery.md` §1).
4. **Re-open a downstream gate.** The plan gate is downstream of proposal and design; the build cannot re-open proposal or design with its own findings. A build-time observation about the visual identity or the requirement spine is a `journal.md` entry, not a re-open.
5. **Edit the estimation project.** The estimatekit instance is a legacy artifact (`REF-Delivery.md` §1, "What survives, and what does not"); the build reads it via the MCP, never writes to it. The audit and the data files are immutable past the proposal gate.
6. **Push a rebase / force-push to the default branch.** The build's commits are conventional, additive, and pushed as the run goes; a force-push is forbidden (`REF-Delivery.md` §5a "Conventional Commits from the first commit").
7. **Write secrets to the repo.** No API keys, no tokens, no credentials in any committed file. The per-app database credential and the registry-pull secret are platform-minted and reflected; the build reads them at runtime from the platform's secret store, never from a `.env` committed to the repo.
8. **Run untrusted code from the build's input.** No `eval` of build-time LLM output, no shelling to a string built from the model's response, no post-install scripts from unverified npm packages. The dependency-audit gate (§7) is the standing check; a new dependency with a post-install script needs the operator's recorded approval.
9. **Invent a colour, font, or asset outside the locked visual identity.** Every UI element reads the brand tokens (`design.md` §1); a non-token colour, a non-locked font, or a stock-photo asset is a defect (`design.md` §1 "A non-token colour anywhere in the build is a defect").
10. **Wait for a human mid-build.** Under `interaction=manual` the build may ask, but the named human gates are pre-authorized; under `interaction=auto` the build takes the assumption protocol and continues. A genuine wall (§14) is the only stopping condition.

## 17. Kickoff (restated for the builder)

The builder reads this section first. The build run starts here.

**You are the build, reading `.delivery/handoff.md` for the run `shoot4fun-2026-07-28` at attempt 1, `mode: interactive`.** The `interaction` flag is set by the launcher per invocation (`REF-Delivery.md` §1) and is not a persisted field of this handoff; the operator launched this run from a terminal, so the launcher passes `interaction: manual` for every step. If a step is later resumed in an automated pod, that step's launcher passes `auto` regardless.

1. **The plan gate is open.** `signed: pending` on this handoff. The build does not start until the operator signs the plan gate (`signed: <date>` after this handoff passes the fresh-eyes review).
2. **Sources of truth, in order:**
   - `intent.yaml` (17 claims, 17 attested) — correctness
   - `.delivery/design.md` (locked visual identity) — look
   - `.delivery/proposal.md` (17 Req IDs, descope list, §4b decisions) — scope
   - the estimation project (`https://estimatekit.chaos-architect.dev` slug `shoot4fun`) — estimate, BRD, roadmap, workbooks, deck (read-only, via MCP)
   - `docs/architecture.md` and `docs/adr/` (the build lands these as a done-criterion) — architecture
   - `docs/brand.md` and `docs/logo*.svg` (the build lands these as a done-criterion) — brand
3. **What you may push, merge, apply, touch:** commits to `main` on the app repo; the platform onboarding PRs (`foundry-onboard-app`, `foundry-onboard-database`) — opened, never merged; per-app secrets written in-cluster by the platform's credential Job; the build's Helm chart values in the deploy branch via the image-updater write-back (you do not edit the chart pin; the platform's reconcile handles it).
4. **What you may NOT do:** the list in §16, restated: descope a priced requirement; merge a platform PR; sign a delivery gate; re-open a downstream gate; edit the estimation project; force-push; commit secrets; run untrusted code from your own input; invent a colour, font, or asset outside the visual identity; wait for a human beyond the named human gates (§11).
5. **Your first acts, in order:**
   1. Scaffold `backend/` (Python/FastAPI/uvicorn, hexagonal layers) via `bootstrap-hexagonal-backend`, wiring `bootstrap-pytest-intent` for the backend claim markers.
   2. Scaffold `apps/client/` (Vite + TypeScript + Three.js) via `bootstrap-threejs-app`, wiring `bootstrap-playwright-intent` for the e2e claim markers.
   3. Port `tests/intent/test_intent_claims.py` into `backend/tests/`; port `tests/intent/intent_claims.spec.ts` into `apps/client/e2e/`. The deployment-evidence test (INT-012) lives in a third tree, `e2e/foundry/deployment.spec.ts` (see §2).
   4. Land the visual identity into `docs/brand.md` and the committed logo assets (already at `docs/logo.svg` / `docs/logo-monogram.svg`).
   5. Land the architecture into `docs/architecture.md` and the first ADR in `docs/adr/0001-…md`.
   6. Implement the claims (REN-001 → DEP-001 in Phase 1, WPN-002 → LDR-002 in Phase 2), running the per-claim tests as you go, promoting `status: draft` to `status: active` when each test passes.
   7. Run `python -m csd_intent.cli .` — must report `CLEAN` with every claim `active`.
   8. Drive `foundry-onboard-app` (and `foundry-onboard-database` for `LDR-002`), poll the PRs to merged per `REF-Delivery.md` §5b.
   9. Run the evidence chain (§13) — CI green, artifacts published, promotion write-back, cache-busted probe, conformance report green, capabilities bound.
   10. Write the chain to `.delivery/build.md` and stop. `reconcile-delivery` is the next phase; it does not re-probe.
6. **If you hit a wall:** the degraded stop-state table (§14) is the menu. A wall is the **only** thing that stops you. A `pytest fail` is a loop, a `csd-intent` violation is a fix, a platform PR refused is a wall. The run's frontmatter `status: aborted` and the worker `exit 64` are the wall-shape; everything else loops to green.
7. **If you are unsure:** the build's journal entry goes in `.delivery/journal.md`; the operator reads it. The durable home of any "we learned this" insight is a `learn(shoot4fun): …` issue on the playbook repo, filed at reconcile, not in-flight.

## 18. Descoped (recorded, per `REF-Delivery.md` §4a)

The following are the proposal's `§"What the verbatim ask does NOT cover"` list, recorded here so no reader has to dig for them. They are not priced, not in `intent.yaml`, and not in the build's surface.

- Identity (accounts, login) — `public-by-design`, no PII
- Chat or voice
- Anti-cheat beyond server-authoritative design
- Persistent player profiles or progression
- Mobile / touch controls
- Server-side matchmaking (lobby is "join and play", not a queue)
- Spectator UI beyond joining a room
- Custom map editor
- Server-region selection (single region per the §4b "opportunistic" decision)
- Monetisation, cosmetics, battle pass

Per `REF-Delivery.md` §4a: "Every proposal requirement either maps to at least one claim or is explicitly descoped in the handoff. No silent drops." This section is the descope, recorded; the 17 claims are the mapped requirements.

## 19. Plan gate

The plan gate closes when this handoff's evidence chain is complete and the fresh-eyes review (`adversarial-review`, `kind=plan`) returns `VERDICT: PASS`. The gate helper writes `signed: <date>` over the operator's approval (interactive mode) or the standing pre-authorization (one-shot mode). A pending gate is never signed by the agent; the helper is its only writer.

| Field | Value |
| --- | --- |
| Status | `in-progress` (gates to `gate` when review passes) |
| Signed | `pending` (the operator confirms the date after the review verdict) |
| Reviewed | empty until the fresh-eyes review lands a `VERDICT: PASS` |
