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
