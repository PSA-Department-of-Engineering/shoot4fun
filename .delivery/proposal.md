---
phase: scope
skill: deliver-engagement
status: complete
gate: proposal
signed: 2026-07-28
reviewed: 2026-07-28
run: shoot4fun-2026-07-28
attempt: 1
mode: interactive
started: 2026-07-28T00:00:00Z
finished:
credential_ref: estimatekit-mcp
---

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
| Audit status | `passed: true` (90 passed, 0 failed, 0 skipped at scope-close) |
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

`VERDICT: PASS`. The reviewer found no blockers; seven non-blocking completeness
observations were resolved in this record and the assumption file before the
gate closed. The reviewed date in the record frontmatter is the date the
fresh-eyes review was run.

## Proposal gate

The proposal gate closes when the operator accepts the estimate and quote. In a
self-serve engagement the operator accepts; the trail records the same.

| Field | Value |
| --- | --- |
| Status | `gate` once the record is in gate-ready form |
| Signed | date the operator accepts (helper-stamped) |
| Reviewed | date the scope's fresh-eyes review passed (helper-stamped) |

This record is the only artifact of the scope phase. `.delivery/proposal.md` is
ephemeral: drained by `reconcile-delivery` when the run closes (§1).
