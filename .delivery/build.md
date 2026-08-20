# build.md — shoot4fun (Login, Profile & Arsenal / P1)

Build-and-ship log for the P1 delivery line (issue #41) over the already-shipped
shoot4fun product. The plan/handoff is `.delivery/handoff.md`; the design
record is `.delivery/design.md`. This record is the phase's run log and final
report. The delivery gate belongs to the customer at the acceptance demo; this
run ends at the done-definition and leaves `signed: pending`.

## Build sequence (as executed)

1. **Pre-flight.** Node 22 + npm 10, Python venv with `pytest-intent`, `csd-intent`
   on PATH, git push access to the shoot4fun repo confirmed. No local Docker (CI
   builds the image). `public/models/robot.glb` already in-repo and CC0 — license
   settled at import (verified; README attribution present).
2. **Visual identity already in `docs/`** — rendered the three new surfaces from
   the same tokens in `apps/client/src/brand/theme.css`; no new hue/font/shape
   (art direction, `.delivery/design.md`).
3. **Surface login (LOGIN-001/002 → INT-023/024).** Mounted `AccountPanel` into
   `MainMenu.tsx`; added e2e markers in `apps/client/e2e/account.spec.ts`.
4. **Profile reconciliation UI (PROF-003 → INT-025).** Verified `pushToAccount`
   (on every setter, gated on `registered`) and `pullFromAccount` (on sign-in,
   `account.actions.ts:132`) form a converging loop; e2e marker in
   `account.spec.ts` asserts local change → server → local-on-resign-in.
5. **Arsenal tile + view (ARS-001/002/003 → INT-026/027/028).** Flipped the
   `arsenal` tile to `status: "ready"` in `menuConfig.ts`; built `Arsenal.tsx`
   rendering the `CharacterLibrary` rig (`RigView.tsx`, placeholder panel) and an
   inventory/loadout section that renders gracefully empty, bound to the ARS-004
   shape. Added e2e markers in `apps/client/e2e/arsenal.spec.ts`.
6. **Arsenal data shape (ARS-004 → INT-029) + ADR-0007.** Authored
   `docs/adr/0007-arsenal-forward-compatible-envelope.md`; implemented the Arsenal
   envelope (`domain/model/arsenal.py`), the `GET`/`PUT /account/arsenal` route
   (server-validated via `ArsenalEnvelope.parse`), and a contract test
   `backend/tests/integration/test_arsenal_shape.py`.
7. **Claims activated** as their tests passed: INT-023…INT-029 `status: active`.
8. **Adversarial review** (fresh-eyes, separate agent). VERDICT: PASS — see
   `.delivery/reviews/build-2026-08-20.md`. Fixed two non-blocking findings: the
   Postgres `get_arsenal` `jsonb` decode, and stale "Draft because" comments in
   `intent.yaml`.
9. **Local verification.** All green — see evidence chain below.

## Evidence chain

| # | Check | Result |
|---|---|---|
| 1 | Backend pytest | 93 passed, 1 skipped |
| 2 | Client `tsc --noEmit` | clean |
| 3 | Client vitest | 83 passed |
| 4 | Playwright e2e (`account`/`arsenal`/`match`/`touch`/`smoke`/`typography`) | 18 passed |
| 5 | `csd-intent` audit | CLEAN (INT-023…INT-029 active + attested; INT-021 active + attested) |
| 6 | `postflight.py` | GO (docs/brand.md + docs/architecture.md landed; audit clean) |
| 7 | Registry / deploy | CI builds images on merge to `main`; the foundry reconciles to `shoot4fun.chaos-architect.dev` (proven live per INT-012, not re-probed in this run) |

## Plan defects encountered

- **AccountPanel-mount gap (LOGIN-001).** `AccountPanel.tsx` shipped on `main`
  but was imported/rendered nowhere, so opt-in login was unreachable. Resolved by
  mounting it into `MainMenu`. Logged as a plan defect because the handoff assumed
  the panel was already surfaced.
- **Crosshair descope (PROF-001/002/003).** "crosshair" named in `design.md`
  profile copy is not a synced field anywhere in the product; the five synced
  preferences are mouse sensitivity, touch sensitivity, master volume, SFX
  volume, haptics. Documented descope, not a silent drop.
- **Postgres `get_arsenal` decode** — fixed (non-blocking, optional at test time).

## Final report

The P1 spine is built and verified against its claims. Seven new claims
(INT-023…INT-029) are `active` with passing tests; PROF-001/002 remain attested
by the existing active `INT-021`. The visual identity is landed in `docs/`
(`docs/brand.md`, `docs/architecture.md`) and ADR-0007 records the Arsenal
envelope. No shipped gameplay or identity claim (INT-001…INT-022) was modified,
no foundry contract file changed.

### Next command
1. Demo the shipped app to the customer against the claims table (INT-023…INT-029
   active + INT-021).
2. On acceptance, close the delivery gate through the gate helper — the only
   writer of `signed:`:
   `python stamp_gate.py --repo D:\Personal\shoot4fun --record build.md --date <acceptance date> --by "<the customer>"`
3. Then run `reconcile-delivery D:\Personal\shoot4fun` (the lifecycle's close; its
   pre-flight refuses an unsigned delivery gate).
