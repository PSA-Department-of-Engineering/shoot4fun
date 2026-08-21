---
phase: scope
skill: deliver-engagement
status: gate
gate: proposal
delivers: P1
signed: pending
reviewed: 
run: 
attempt: 1
mode: interactive
started: 2026-08-21T15:59:02Z
finished: 
credential_ref: 
---

# Proposal — Shoot4Fun Shop Surface

## Requirement spine (Phase 1: Shop Surface)
This line delivers exactly one estimation phase: **P1 — Shop Surface**.

| Req ID | Description |
|--------|-------------|
| SHOP-001 | Browse the catalog of available cosmetics/items |
| SHOP-002 | View item detail (name, description, preview, rarity) |
| CAT-001 | Define the cosmetics catalog (source & authorship) |
| ACQ-001 | Acquire items (Arsenal acquisition entry point) |
| ACQ-002 | Persist acquired items into the Arsenal envelope |
| ACQ-003 | Ownership & entitlement model for acquired items |
| COS-001 | Apply acquired cosmetics to the player model |
| PLAT-001 | Shop operates over the authenticated account/profile |
| PLAT-002 | Respect the Arsenal envelope contract (ADR-0007), no migration |

Delivered line (frozen context, not re-driven): `shoot4fun-login-profile/P1` (login, profile, Arsenal envelope). The shop builds over it.

## Estimation project
- Project slug: `shoot4fun-shop` on the estimatekit instance
- Deck: `<estimatekit-instance>/projects/shoot4fun-shop/slides/`
- Workbooks / roadmap: instance `output/excel/` and `output/roadmap/`
- Audit: **passed** (62 checks, 0 failed; one non-blocking scheduling warning)

## Scope notes
- Monetization is deferred; acquisition is modeled as a free unlock/grant that writes an ownership record into the Arsenal envelope (ADR-0007). The currency/pricing model is an explicit out-of-scope decision for this phase.
- "Apply to the player model" is in scope (per ticket #64's stated deliverables), not scope creep.

