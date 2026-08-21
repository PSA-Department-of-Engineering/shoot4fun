# Delivery journal — Shoot4Fun Shop Surface

## 2026-08-21 — scope (deliver-engagement, attempt 1)
- Line opened as a follow-on to the delivered `shoot4fun-login-profile/P1`. Shop surface scoped as a single new phase `shoot4fun-shop` / P1.
- Door: shop was absent from any estimation project → authored a distinct new slug (additive, not an overwrite of the frozen P1 estimate).
- Adversarial review caught real gaps (acquisition/entitlement engine, catalog source, Arsenal read-back, UX states); all priced and closed. One reviewer finding ("Apply is scope creep") was a misread of ticket #64, which explicitly lists Apply — retained.
- Audit: 62 passed, 0 failed.
- Lesson: estimatekit's `test_project_totals_consistency` expects the P1-build TSV total to equal Design + Build Activities in the project file; design effort must live inside the build TSV, not only as a separate project row.
