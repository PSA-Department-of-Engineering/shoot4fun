# Customer request

The verbatim ask that enters the Scope phase (REF-Delivery section 2); ground truth for what was asked.

---

Build a shop surface for Shoot4Fun where players can browse and acquire cosmetics/items that populate the Arsenal inventory (already a forward-compatible empty envelope per ADR-0007).

Verbatim requirement (ticket #64): "A shop surface where players can browse and acquire cosmetics/items to populate the Arsenal inventory. The Arsenal envelope (ADR-0007) is forward-compatible; the shop is the acquisition entry point."

Scope to deliver:
- Browse: players can view the catalog of available cosmetics/items.
- Acquire: players can obtain items (the Arsenal acquisition entry point).
- Apply: acquired cosmetics can be applied to the player model.

Why deferred: P1 delivered login, profile persistence, and the Arsenal surface (empty, forward-compatible) in v1.11.0 via PR #53. Monetization/shop UX was explicitly out of P1 scope. Depends on: Arsenal envelope (ADR-0007), account/profile (already on main). Linked to #41 (deferred list).
