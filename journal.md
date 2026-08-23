# Delivery journal — Shoot4Fun Shop Surface

## 2026-08-21 — scope (deliver-engagement, attempt 1)
- Line opened as a follow-on to the delivered `shoot4fun-login-profile/P1`. Shop surface scoped as a single new phase `shoot4fun-shop` / P1.
- Door: shop was absent from any estimation project → authored a distinct new slug (additive, not an overwrite of the frozen P1 estimate).
- Adversarial review caught real gaps (acquisition/entitlement engine, catalog source, Arsenal read-back, UX states); all priced and closed. One reviewer finding ("Apply is scope creep") was a misread of ticket #64, which explicitly lists Apply — retained.
- Audit: 62 passed, 0 failed.
- Lesson: estimatekit's `test_project_totals_consistency` expects the P1-build TSV total to equal Design + Build Activities in the project file; design effort must live inside the build TSV, not only as a separate project row.

## 2026-08-21 — design (design-session, attempt 1)
- Follow-on rule applied: the shipped identity (`docs/brand.md`, `docs/logo.svg`) is inherited verbatim — no second look minted. Protopane theme verified byte-identical to brand.md's 19 keys.
- Extended the prototype with three shop surfaces in the same brand language: `shop-catalog`, `shop-item-detail`, `shop-acquired`; enabled the main-menu Shop tile.
- Fresh-eyes review needed two re-drives before PASS: rarity→colour semantics were example-only (fixed with a five-tier legend), the browse→detail path was unpinned (fixed: whole-card link, Unlock lives on detail only), then two AA contrast defects in my own new markup (white-on-gradient Legendary badge; small `text-primary` links) — fixed to dark-on-gradient and high-contrast treatments.
- Lesson: inheriting a locked identity does not inherit its *decisions* — brand.md's dark-on-gold rationale had to be re-derived and extended (Legendary gradient) during review; write accessibility decisions down at the moment they are made.
- Non-blocking findings carried to the build: white-on-orange small badges sit below AA (locked token pair, customer-visible at acceptance demo); rarity tier overloads `--primary`'s interactive meaning; item preview art treatment unpinned (CAT-001 authorship is prose, not visual).
- Note: proposal gate still reads `signed: pending` — design ran ahead of the signed spine at the operator's direction; both gates await their signer.

## 2026-08-22 — intent+plan (intent-session, attempt 1)
- Opened by signing the pending proposal gate first (operator Carlos Dias approved over the recorded passing review; helper stamped). Design gate was already closed.
- Authored nine additive claims INT-030..INT-038 against the SHOP/CAT/ACQ/COS/PLAT spine; audit CLEAN (38 claims, 24 attested; nine drafts are the declared gap the build activates). No shipped claim mutated.
- Operator decisions settled live: proposal approval; COS-001 pinned to material skins over the existing rig (RENDER-001 resolved without new assets); catalog = static authored `backend/catalog/cosmetics.json`.
- Fresh-eyes review needed three rounds. Round 1 FAIL caught two real plan defects my context was blind to: INT-036's `data-equipped-skin` named an avatar host element that doesn't exist (Avatar.ts renders remote players only; RigView.tsx is the player-model surface), and the reserved envelope key (`data.items`) would have persisted acquisitions invisibly beside the Arsenal view's `data.inventory` binding — every claim could have passed while the verbatim ask ("populate the Arsenal inventory") silently failed.
- Lesson: attestability must be checked against the *rendered surface inventory*, not the class that sounds right — the honest observable for a Three.js material change is the DOM host of whichever component mounts the model (RigView), written by the apply routine itself.
- Lesson: when a delivered shape exists, ownership conventions must ride the collection consumers already read; inventing a parallel "authoritative" key creates a second source of truth that passes every test and misses the product point.
- Round 3 PASS carried one minor (INT-034 activation ordering across steps 3–4); resolved with the reviewer's prescribed sentence immediately after, noted in the review artifact.
- Platform facts verified against ground truth (get_app + conformance 252 passed): hostname, deploy-chaos, promotion auto, has_database/no identity, image set {server, client, docs}. No onboarding or grants priced this run.
- Plan gate reached: reviewed 2026-08-22, awaiting the operator's stamp (`stamp_gate.py --record handoff.md`), then `run-delivery-plan`.

## 2026-08-23 — build+ship round 3 (probe): the wall was ours, not the platform's

- One cache-busted `POST /api/account/guest` returned `{"error":"UndefinedColumnError","detail":"internal error"}`. A JSON body is 1.16.1's handler, so the pod **had** rolled — round 2's "the serving pod never became ready" was an inference from an empty body, and it was wrong on both counts (rollout fine, fault repo-side).
- Named cause: `account_sessions.expires_at`. `c449243` added the column inside `CREATE TABLE IF NOT EXISTS account_sessions (...)` and taught the session INSERT to name it, with no `ALTER`. On a prod table minted at #30's deploy the CREATE is a no-op, so the column is absent and every write that opens a session raises. It explains the entire §10 probe table with one cause: reads pass, other tables' writes pass, only the session INSERT fails.
- Drift audit of the whole schema block since #30: the `recovery_hash`→`password_hash` move is covered by its `ALTER` pair, `arsenal_profiles` is a new table (safe), `account_profiles` is unchanged; `expires_at` is the only uncovered one.
- Operator decision: the migration is folded into this phase's **re-drive**, not filed as a maintenance ticket — the line owns the blocker it hit.
- Lesson: `CREATE TABLE IF NOT EXISTS` is first-run scaffolding, not schema management. Every column added to that block after the first deploy needs its own `ADD COLUMN IF NOT EXISTS`, and the reviewer's question at every schema change is "what does this do to a database that already exists?"
- Lesson: a pg round-trip test on a fresh database attests the SQL and can never attest the migration. The only test that would have caught this builds the *old* table shape, runs `connect()`, and then exercises the path — an upgrade test, which is now part of the re-drive.
- Lesson: an empty-bodied 500 is absence of evidence; round 2 read it as evidence of a stalled rollout and spent the round on the platform. Round 2's real contribution was the instrumentation — shipping the fault-naming handler is what turned a two-candidate platform guess into a one-line repo diagnosis. Instrument first, infer second.
- Scratch migrated this day onto this line's own `delivery/2026-08-21` ref with the records at branch root (decisions/0003). The line had run in the pre-0003 shape — scratch committed on `main`, the ref carrying the feature work — so the Console listed the ref's root, found no records, and reported the line as "scope · ready to drive" while it was in fact parked degraded at build+ship. The records are unchanged by the move; only where they live changed.
