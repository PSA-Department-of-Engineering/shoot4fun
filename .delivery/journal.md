# Delivery Journal — shoot4fun (Login, Profile & Arsenal)

## 2026-08-19 — design phase

- Follow-on line over the shipped Shoot4Fun app. Reused the locked visual
  identity in `docs/brand.md` (19-key shadcn set + logo) verbatim; no new
  look was minted (per REF-Delivery.md §1 additive rule).
- Created Protopane project `shoot4fun` seeded with the locked brand tokens,
  and prototyped the three new P1 surfaces as token-backed screens:
  `account` (opt-in login / AccountPanel), `profile` (server-synced
  preferences), `arsenal` (operator + gracefully-empty loadout).
- Fresh-context adversarial design review passed (no blockers):
  `.delivery/reviews/design-2026-08-19.md`.
- Customer approved the look live; design gate closed into
  `.delivery/design.md`.

## 2026-08-19 — intent + plan phase

- Authored 7 new P1 claims appended to the maintained `intent.yaml` (INT-023…
  INT-029); PROF-001/002 mapped to the existing active INT-021 (server-side
  profile store + follow-to-device), not re-derived — additive over the shipped
  spec, never regressed INT-001…INT-022.
- Plan defects surfaced and resolved this phase:
  - Crosshair: `design.md` names crosshair among synced prefs, but no crosshair
    field exists in `PlayerProfile`/client. Operator-confirmed: ship the 5 built
    synced prefs (mouse/touch sensitivity, master/SFX volume, haptics); crosshair
    stays a local HUD visual this phase. Documented descope, not a silent drop.
  - AccountPanel is built but orphaned (zero imports); LOGIN-001 is the surfacing
    gap — the build mounts it. Integration point left to the smallest-reasonable
    choice (handoff §0 fallback).
  - ARS-004 forward-compatible Arsenal data shape deferred to ADR-0007 (build
    authors before code); INT-029 contract test proves over-shaped payloads
    round-trip without loss.
- Fresh-context adversarial plan review passed (no blockers):
  `.delivery/reviews/handoff-2026-08-19.md`. Plan gate reached (`signed: pending`),
  awaiting the operator's stamp.
