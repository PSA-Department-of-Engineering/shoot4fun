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
