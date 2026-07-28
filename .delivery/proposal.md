---
phase: scope
skill: deliver-engagement
status: complete
gate: proposal
signed: 2026-07-28
reviewed: 2026-07-28
run: shoot4fun-2026-07-28
attempt: 3
mode: interactive
started: 2026-07-28T00:00:00Z
finished:
credential_ref: estimatekit-mcp
---

> **Revision log — attempt 3.** The proposal was re-opened on 2026-07-28 by
> the operator after a UI review caught that the resource plan's
> `Rate Day` column was `EUR 0` for every profile. The rate column is
> what the estimation engine's quote and financial model derive their
> numbers from; zero rates produce a zero quote, which is misleading
> even when the engagement is self-serve. The fix sets the rates to
> market values (Delivery Manager 280, Solution Architect 360, Tech
> Lead 360, QA Engineer 250 EUR/day, matching the scaffold) and updates
> `COM-001` to record that the rates are market rates while the actual
> billing is self-serve-zero. Req IDs, matrix, and effort are unchanged.
> The attempt-2 record is preserved in git history; the attempt-2 review
> is at `.delivery/reviews/proposal-2026-07-28-attempt-2.md`.

> **Revision log — attempt 2.** The proposal was re-opened on 2026-07-28 by the
> operator to swap the WebSocket backend technology from Node.js to Python
> (FastAPI). Reason: the team's skills and the PSA platform's other backend
> services are Python; Node.js was an off-pattern choice that the first
> attempt's scope recorded by default. See the "Revisions" section below for
> the diff and the rationale; the customer-asked requirements (17 Req IDs,
> matrix, effort) are unchanged. The previous review is preserved at
> `.delivery/reviews/proposal-2026-07-28-attempt-1.md`.

# Proposal — shoot4fun

## Customer request (verbatim)

> simple multiplayer threejs shooter

Original language: English. Preserved without paraphrase, per `REF-Delivery.md` §2.
The customer's ask is one line. Every requirement in the matrix below traces
back to a meaningful token in that line: `simple`, `multiplayer`, `threejs`,
`shooter`. The implicit needs a working game requires — a player to control,
a place to play, a way to keep score, a way to host the match — are derived
from those four tokens and recorded as Req IDs.

## Engagement identity

| Field | Value |
| --- | --- |
| Name | Shoot4Fun |
| Slug | `shoot4fun` |
| Customer | Self (Carlos Dias) — self-serve, operator signs the four gates |
| Target hostname | `shoot4fun.chaos-architect.dev` |
| Repo | `https://github.com/PSA-Department-of-Engineering/shoot4fun` |
| Local path | `D:\Personal\shoot4fun` |

## §4b operator decisions (recorded)

| Decision | Value |
| --- | --- |
| Content language | English |
| License | MIT (permissive) |
| Registry / package visibility | public |
| Infrastructure availability window | opportunistic, no SLA |
| Security / data classification | public-by-design (no PII, no secrets) |
| Quality bars | best-effort; browser matrix = modern evergreen |

## Gate signer

Operator (self-serve). One signer for all four gates; the trail records the same
either way (`REF-Delivery.md` §1).

## Run mode

`mode=interactive`. This skill hands the operator the next command at each gate;
the four phases after Scope run in fresh sessions, joined by artifacts, not memory.

## Estimation project

A live estimatekit project backs this scope. The proposal record points at it;
**it does not copy its contents** (`REF-Delivery.md` §1, anti-pattern #2 in
`REF-Estimatekit.md` §8).

| Field | Value |
| --- | --- |
| Estimatekit instance | `https://estimatekit.chaos-architect.dev` |
| Project slug | `shoot4fun` |
| API | `POST /api/projects/shoot4fun/audit`, `POST /api/projects/shoot4fun/generate` |
| Deck URL | `https://estimatekit.chaos-architect.dev/projects/shoot4fun/slides/` |
| Audit status | `passed: true` (90 passed, 0 failed, 0 skipped; re-confirmed at attempt 2 after the technology revision) |
| Generation | `roadmap`, `excel`, `slides` all `true` |

## Requirement spine

Req IDs minted by the estimatekit audit. They are immutable; downstream
traceability (intent claims, ADRs, build activities) references these IDs by
`derived_from` (`REF-Delivery.md` §4a).

### Phase 1 — MVP (12 requirements, ~45 MD build effort)

| Category | Req ID | Description | Maps to verbatim token |
| --- | --- | --- | --- |
| 3D & Rendering | `REN-001` | 3D scene rendered with Three.js | `threejs` |
| 3D & Rendering | `CAM-001` | First-person camera with mouse-look controls | `shooter` |
| Player Mechanics | `MOV-001` | Player movement: WASD keys on a flat ground plane | `shooter` |
| Player Mechanics | `SHO-001` | Hitscan or projectile-based weapon fired on mouse click | `shooter` |
| Player Mechanics | `HP-001` | Player has hit points and respawns on death | `shooter` |
| Arena | `MAP-001` | One arena map: bounded flat ground with simple cover objects | `simple` |
| Arena | `COL-001` | Player-to-wall and player-to-player collision | `simple` |
| Networking | `NET-001` | WebSocket-based real-time multiplayer supporting 2 to 4 players in a single room | `multiplayer` |
| Networking | `SYNC-001` | Server-authoritative position and rotation replication at a tick rate that feels live | `multiplayer` |
| Match | `SCO-001` | Per-player kill counter; top score wins the match | `shooter` |
| Match | `MAT-001` | Match lifecycle: lobby → playing → results | `multiplayer` |
| Deployment | `DEP-001` | Containerised Three.js frontend and WebSocket backend, deployed to the PSA Foundry | (derived; "deployed" is the only way to ship, and "PSA Foundry" is a §4b operator decision — `Registry / package visibility: public` plus the PSA-Department-of-Engineering org context, not a customer ask) |

### Phase 2 — Polish (5 requirements, ~18 MD build effort)

| Category | Req ID | Description | Maps to |
| --- | --- | --- | --- |
| Polish | `WPN-002` | At least two distinct weapons with different feel | `shooter` (extension) |
| Polish | `MAP2-002` | At least two arena maps selectable from the lobby | `simple` (revisited) |
| Polish | `SND-002` | Sound effects: gunshots, hits, footsteps, lobby and results stings | `shooter` (extension) |
| Polish | `VFX-002` | Visual polish: muzzle flash, hit particles, lighting pass, basic shadows | `threejs` (extension) |
| Polish | `LDR-002` | Persistent best-score leaderboard per arena (read from a backend store) | `shooter` (extension) |

### What the verbatim ask does NOT cover (assumed-out, not priced)

The following are deliberately **not** priced into the build. They are noted
so the operator can see what the simple ask does not ask for; if any of
these are wanted, they are scope additions, re-driven through the scope
phase per `REF-Delivery.md` §4c.

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

## Assumptions recorded (11, all in `data/assumptions/02-assumptions.tsv`)

| ID | Short title | Confidence | Impact | Req IDs |
| --- | --- | --- | --- | --- |
| `ARCH-001` | Cheat-resistance is server-side | HIGH | MEDIUM | SYNC-001, MAT-001, SCO-001 |
| `ARCH-002` | Client-side prediction + reconciliation | HIGH | LOW | SYNC-001 |
| `NET-001` | JSON-over-WS is sufficient | HIGH | LOW | NET-001, SYNC-001 |
| `PERF-001` | Single instance handles 2–4 players | HIGH | LOW | NET-001, SYNC-001 |
| `DEP-001` | PSA Foundry hosts client + server | MEDIUM | HIGH | DEP-001 |
| `DEP-002` | PSA database grant is sufficient for leaderboard | MEDIUM | HIGH | LDR-002 |
| `QA-001` | Modern evergreen browsers are enough | MEDIUM | LOW | DEP-001, MAT-001 |
| `SCOPE-001` | Simple = MVP, P2 is bonus | HIGH | HIGH | ALL |
| `DSCP-001` | Descope list is exhaustive, not silent | MEDIUM | LOW | ALL |
| `PLAT-001` | Auto-promotion is on for both images | HIGH | LOW | DEP-001 |
| `COM-001` | Resource rates are zero, by design (self-serve) | HIGH | LOW | DEP-001 |

## Auditor warnings noted, not blocking

The auditor returns `passed: true` (90/0/0) but surfaces five severity-`warning`
suggestions. They are recorded here so a future reader of the proposal
knows they were considered, not silently ignored:

- **`zero-design-lead`** (P1 and P2) and **`zero-testing-lag`** (P1 and P2):
  the personal-engagement shape runs build and test concurrently and starts
  build alongside design; the design phase itself is a separate session in
  `REF-Delivery.md` §3, so the build-time design runway is incremental only.
- **`thin-design`** (P1 7%, P2 6%) and **`thin-qa`** (P1 0%, P2 0%): the
  build's QA effort is in the `QA` group of `P<n>-build.tsv` (e.g.
  `BUILD-QA-001` Playwright e2e), not in a separate project row, so the
  percentage reads 0 against the explicit "Testing & QA" project row even
  though QA is fully priced.
- **`off-grid-allocation`** (DM/SA/QA at 1–2 days/month): a self-serve
  engagement, so fractional roles are accurate and grid-alignment is not
  worth forcing.

## Adversarial review

The scope's fresh-eyes pass is run as a separate `adversarial-review` invocation
(`REF-Delivery.md` §1), against the verbatim ask, the BRD, the matrix, the
audit, and the generated artifacts. The review's verdict and any findings are
appended below before the proposal gate closes; the gate does not close over
a `FAIL` verdict.

### Review outcome

`VERDICT: PASS`. The second-pass reviewer found no blockers and no non-blocking
findings. The first-pass reviewer had returned FAIL on four items (pre-asserted
verdict in this subsection, stale Cost text on the slide page, two citation
errors); all four were fixed before this pass. The rate correction is coherent
across the data files, `COM-001`, the slide page, and the Excel workbooks
(VROM slide shows € 37,500 total revenue). The audit is green (90/0/0), 17
Req IDs and the matrix are unchanged, build effort is preserved, and the
preserved review trail is intact.

**Preserved review trail:**

- Attempt 1 (Node.js backend, 1 review pass, PASS): `.delivery/reviews/proposal-2026-07-28-attempt-1.md`
- Attempt 2 (Node.js → Python, 3 review passes — 2 FAIL then PASS): `.delivery/reviews/proposal-2026-07-28-attempt-2.md`
- Attempt 3 (rates EUR 0 → market, 2 review passes — 1 FAIL then PASS): `.delivery/reviews/proposal-2026-07-28.md`

## Proposal gate

The proposal gate closes when the operator accepts the estimate and quote. In a
self-serve engagement the operator accepts; the trail records the same.

| Field | Value |
| --- | --- |
| Status | `gate` once the record is in gate-ready form |
| Signed | date the operator accepts (helper-stamped) |
| Reviewed | date the scope's fresh-eyes review passed (helper-stamped) |

## Revisions

### Attempt 3 — 2026-07-28 — Resource rates: EUR 0 → market rates

| Field | Attempt 2 | Attempt 3 |
| --- | --- | --- |
| Delivery Manager rate | EUR 0 | EUR 280/day |
| Solution Architect rate | EUR 0 | EUR 360/day |
| Tech Lead rate | EUR 0 | EUR 360/day |
| QA Engineer rate | EUR 0 | EUR 250/day |
| Quote output | Zero (misleading) | Meaningful market-rate quote |
| `COM-001` | "Resource rates are zero, by design" | "Market rates drive the quote; billing is self-serve-zero" |
| Customer-asked requirements | 17 Req IDs | 17 Req IDs (unchanged) |
| Build effort (P1 + P2) | 45 + 18 MD | 45 + 18 MD (unchanged) |
| Audit | 90 passed, 0 failed | 90 passed, 0 failed (re-run) |
| Adversarial review | VERDICT PASS | (this attempt; see below) |

**Rationale.** A UI review of the resource plan showed every `Rate Day`
cell was `EUR 0`. The estimation engine derives the quote and financial
model from the rate column, so zero rates produced a zero quote — which
is misleading even when the engagement is self-serve. The fix sets the
rates to market values (matching the estimatekit scaffold's defaults)
and updates `COM-001` to record that the rates are the basis for any
future commercial comparison while the actual billing for this
self-serve engagement is zero.

**Files changed on the estimatekit instance.**

- `data/activities/P1-resource.tsv` — `Rate Day` column: `EUR 0` → market rates (DM 280, SA 360, TL 360, QA 250).
- `data/activities/P2-resource.tsv` — same.
- `data/assumptions/02-assumptions.tsv` — `COM-001` retitled to "Market rates drive the quote; billing is self-serve-zero" and the body now names the four market rates and the self-serve-zero billing.
- `data/slides/executive-summary.tsv` — the customer-facing `Highlight → Cost` row changed from "Best-effort: personal engagement, no professional services rates" to "Self-serve engagement — market rates drive the quote, actual billing is zero".
- Architecture diagrams, build activities, BRD, matrix, project activities, config — all unchanged.

**Re-run evidence.**

- Audit re-run after the rate change: 90 passed, 0 failed, 0 skipped.
- Generation re-run: `roadmap`, `excel`, `slides` all `true`. The Excel quote and financial model now carry the new numbers (VROM slide shows € 37,500 total revenue, GM 30%).
- **Stale-cache note (operational learning, not a scope defect).** The first `estimatekit_generate_artifacts` call after the rate change returned success but did not rebuild the executive-summary slide page — the generated `output/slides/pages/02-executive-summary.md` still carried the old "Best-effort: personal engagement, no professional services rates" Cost row even though the source TSV was already updated. The auditor does not check generated page content for cross-consistency with data files. A second `generate_artifacts` call rebuilt the page correctly. For any future re-open: call `generate_artifacts` twice when changing data that flows into the slide pages, or assert the page content matches the data after generation.
- Adversarial review re-run: see `.delivery/reviews/proposal-2026-07-28.md` (attempt 3) and the "Adversarial review" section above.

**What this is NOT.** This is not a customer-driven scope change (the
verbatim ask is unchanged). It is a parameter correction in the
estimation data so the artifacts the estimation engine produces are
meaningful. The previous attempt-2 review (now preserved at
`.delivery/reviews/proposal-2026-07-28-attempt-2.md`) is unaffected.

### Attempt 2 — 2026-07-28 — WebSocket backend: Node.js → Python (FastAPI)

| Field | Attempt 1 | Attempt 2 |
| --- | --- | --- |
| Backend technology | Node.js + ws | Python (FastAPI) + uvicorn |
| Authoritative tick loop | `setInterval`-driven | `asyncio` task-driven |
| Match state machine | Node.js in-memory | Python in-memory (asyncio.Lock) |
| Team-skill alignment | Off-pattern | Team-canonical (PSA FastAPI) |
| Platform alignment | Off-pattern (no other Node backend in PSA Foundry) | Aligned (task-api, alexandria, others) |
| Customer-asked requirements | 17 Req IDs | 17 Req IDs (unchanged) |
| Build effort (P1 + P2) | 45 + 18 MD | 45 + 18 MD (unchanged) |
| Audit | 90 passed, 0 failed | 90 passed, 0 failed (re-run) |
| Adversarial review | VERDICT PASS, 7 non-blocking resolved | (this attempt; see below) |

**Rationale.** The team's skills are Python (REF-Python, REF-FastAPI,
REF-CleanArchitecture) and the PSA platform's other backend services are all
Python/FastAPI. Node.js was an off-pattern default that attempt 1 inherited
from the estimatekit scaffold. The swap aligns the scope with the
`bootstrap-hexagonal-backend` skill (which scaffolds a Python/FastAPI
hexagonal backend) and removes the only language split in the stack.

**Files changed on the estimatekit instance.**

- `data/architecture/P1-components.tsv` — `WebSocket Server` technology: `Node.js + ws` → `Python (FastAPI) + uvicorn`; `Authoritative Tick Loop` technology: `Node.js` → `Python asyncio`; `Match State Machine` technology: `Node.js in-memory` → `Python in-memory (asyncio)`.
- `data/activities/P1-build.tsv` — `BUILD-BE-001` now names the FastAPI ASGI app and uvicorn entrypoint; `BUILD-BE-002` now names the asyncio tick task; `BUILD-BE-003` now names `asyncio.Lock` for shared state.
- `data/assumptions/02-assumptions.tsv` — `PERF-001` retitled to "Single FastAPI instance handles 2–4 players" and its body now names Python/FastAPI/uvicorn; `DEP-001`'s body now names the FastAPI WebSocket server workload (its `Short Title` "PSA Foundry hosts client + server" is unchanged, only the body was updated to name the new image).
- `data/slides/executive-summary.tsv` — the customer-facing `Rationale → Backend` row changed from `Node.js + ws WebSocket server` to `Python (FastAPI) + uvicorn WebSocket server (asyncio tick loop, server-authoritative)`. **Correction:** the attempt-2 revision log first claimed this file was unchanged; the attempt-2 fresh-eyes review caught the miss, the file was edited, and the slides pipeline was re-generated. The corrected file is the one persisted and re-generated now.
- Architecture PUML diagrams, `00-guidelines.tsv`, `project.yaml`, and `data/slides/notes.tsv` were unchanged: none named a backend language. (The diagram label `WebSocket Server` is generic; the speaker notes are also generic.)

**Re-run evidence.**

- Audit re-run after the swap: 90 passed, 0 failed, 0 skipped.
- Generation re-run: `roadmap`, `excel`, `slides` all `true`.
- Adversarial review re-run: see `.delivery/reviews/proposal-2026-07-28.md` (attempt 2) and the "Adversarial review" section above.

**What this is NOT.** This is not a customer-driven scope change (the
verbatim ask is unchanged); the customer's request did not name a backend
language. This is an architecture refinement, recorded in the scope per
`REF-Delivery.md` §1 ("An operator re-opens a phase, deliberately sending
the line back to an earlier gate").

---

This record is the only artifact of the scope phase. `.delivery/proposal.md` is
ephemeral: drained by `reconcile-delivery` when the run closes (§1).
