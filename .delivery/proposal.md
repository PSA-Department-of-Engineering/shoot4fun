---
phase: scope
skill: deliver-engagement
status: complete
gate: proposal
signed: 2026-08-19
reviewed: 2026-08-19
run: s4f-lp-001
attempt: 1
mode: interactive
started: 2026-08-19T16:55:59Z
finished: 2026-08-19T17:03:24Z
credential_ref: opencode-session
delivers: P1
---

# Proposal — Shoot4Fun: Login, Profile & Arsenal

Delivery line for **issue #41** (Player login + profile persistence, with Arsenal
button next to Settings). This line delivers exactly **one estimation phase, P1**.

## Source of truth

- Verbatim customer request: `data/requirements/00-customer-requirements.txt` in the
  estimation project `shoot4fun-login-profile` (EstimateKit / PSA instance).
- Engagement brief: GitHub issue #41, with the reporter's clarification that
  "Inventory" is the **Arsenal** — the `arsenal` tile already exists in the main
  menu (`apps/client/src/ui/views/pages/menuConfig.ts`, `status: "soon"`) and this
  line makes it functional rather than adding a new AppBar button.
- Account infrastructure is already landed on `main` (AccountPanel, account
  viewmodels, backend account service + repositories); this line surfaces login and
  adds profile persistence + the Arsenal view on top of it.

## Requirement spine (P1)

| Req ID | Description |
| ------ | ----------- |
| LOGIN-001 | Opt-in player login surfaced through the existing AccountPanel |
| LOGIN-002 | Guests keep working; login is opt-in and non-blocking |
| PROF-001 | Server-side profile stores the player's settings and preferences |
| PROF-002 | Settings restored on any client the player logs into (cross-device/browser/session) |
| PROF-003 | Local-only settings reconciled with the server-side profile |
| ARS-001 | Make the existing Arsenal main-menu tile functional (opens the Arsenal view) |
| ARS-002 | Arsenal view renders the player model (current character/outfit) |
| ARS-003 | Arsenal view renders the inventory/loadout section, gracefully empty |
| ARS-004 | Inventory/player-model data shape is forward-compatible (no data loss on growth) |

## Estimation project pointer

- Project slug: `shoot4fun-login-profile` (EstimateKit / PSA instance).
- Audit status: **passed** (clean; only a "thin design" advisory, design effort is
  captured via the `Design Lead` config parameter).
- Generated artifacts: roadmap, Excel workbooks (quote / financial / BRD), and the
  executive Slidev deck. The deck is served by the instance at
  `/projects/shoot4fun-login-profile/slides/`; workbooks are downloadable via the
  instance API. The estimation project is a **legacy** artifact after this gate —
  nothing downstream reopens it; the requirement spine above is the durable handoff.

## Phase pin

`delivers: P1` — single phase. Downstream lifecycle phases (design, intent+plan,
build+ship, learn) read this record, never the estimation project.

> Fresh-eyes review passed 2026-08-19 (VERDICT: PASS; artifact `.delivery/reviews/proposal-2026-08-19.md`); recorded in `reviewed:`. The proposal gate awaits its signer (REF-Delivery.md section 1).

> Gate closed: proposal signed 2026-08-19 by CarlosDSkills over a passing fresh-eyes review (REF-Delivery.md section 1). Prose above predates the closure.
