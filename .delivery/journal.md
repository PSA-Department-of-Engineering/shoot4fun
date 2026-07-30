---
learned: 2026-07-30
---

# Journal — shoot4fun

## 2026-07-30 — Reconcile (Learn phase, `interaction=auto`)

Reconciling run `shoot4fun-2026-07-28` (delivery repo: `PSA-Department-of-Engineering/shoot4fun`, studio key `shoot4fun` throughout). No prior journal entries existed — nothing was logged during scope, design, intent, or build.

**Step 1 — done, not degraded.** `.delivery/build.md` reads `status: complete`, gate `delivery`, `signed: 2026-07-30`, `reviewed: 2026-07-30`. Build+Ship already verified the app live (evidence chain 7/7, with the noted probe caveat); reconcile did not re-probe.

**Step 2 — claims.** `python -m csd_intent.cli .` reports both projects `CLEAN`: root `intent.yaml` 17/17 claims attested (matches `build.md`'s own count); `docs/intent.yaml` (the `bootstrap-starlight` docs-site bundle, 2 claims, both deliberately `status: draft` per commit `e4f1f87` so the audit only counts active claims) — not part of the delivery's 17-claim spine, no finding.

**Step 3 — durable homes.** `docs/brand.md`, `docs/architecture.md`, `docs/adr/0001-…md` all landed and populated; README carries the branded header. Two gaps found, moved to tickets (below) rather than fixed in-place, since reconcile proposes and does not itself edit the shipped app:
- **No `LICENSE` file.** `License: MIT` is recorded in `proposal.md`, `handoff.md` §5, and `docs/brand.md`, but no `LICENSE` file or license metadata exists anywhere in the repo.
- **Locked typography stack partially unwired.** `docs/brand.md` locks 4 fonts (Russo One, Bungee, Inter, JetBrains Mono), self-hosted per `handoff.md` §5/§12. Only Inter (as a system-font fallback) is actually wired — `apps/client/src/brand/theme.css` has no `@font-face` rules, `apps/client/public/fonts/` doesn't exist, `.hud-number` renders in Inter (not Bungee — a direct miss of the accessibility bar's "HUD number ≥ 24px Bungee" floor), and room codes/key-hints use a generic monospace stack instead of JetBrains Mono. A related smaller miss: `index.html` links a nonexistent `/favicon.svg`. No test or review caught any of this.

**Studio slug linkage (anti-pattern 33 check).** Confirmed via the committed records — no live studio queries were available or needed (reconcile runs no cluster/studio MCP checks per its pre-flight). `proposal.md` (estimatekit: "Project slug | `shoot4fun`"), `design.md` (protopane: `slug: shoot4fun` in frontmatter, "Slug | `shoot4fun`" in body), and `handoff.md`/`build.md` (platform: `onboard_app(name="shoot4fun", ...)`, namespace `shoot4fun`, `app_status shoot4fun`) all reference the identical verbatim slug `shoot4fun`. No studio fell back to a reworded, hyphenated, or otherwise altered variant; no divergence to log.

**Step 4 — tickets filed** (playbook repo resolved via `get_sync_status`: `PSA-Department-of-Engineering/ai-coding-prompts`; delivery repo: `PSA-Department-of-Engineering/shoot4fun`):

- `learn:` PSA-Department-of-Engineering/shoot4fun#1 — land the MIT LICENSE file
- `learn:` PSA-Department-of-Engineering/shoot4fun#2 — wire the locked typography stack (Bungee/Russo One/JetBrains Mono) + fix broken favicon link
- `learn(shoot4fun):` PSA-Department-of-Engineering/ai-coding-prompts#34 — build exit criteria have no typography-conformance check (only colour-token conformance)
- `learn(shoot4fun):` PSA-Department-of-Engineering/ai-coding-prompts#35 — build exit criteria have no LICENSE-landing check for a pinned licence decision
- `learn(shoot4fun):` PSA-Department-of-Engineering/ai-coding-prompts#36 — first `onboard_app` image_components should cross-check the app's own CI-built images (the `docs` image gap that forced build attempt 5's re-drive; already root-caused upstream as `PSA-Department-of-Engineering/platform-studio#11` for the orphaned-branch half of that incident, filed during build, not refiled here)

No lessons went unfiled; nothing UNFILED below.

**Step 5 — scratch close.** `interaction=auto`: not deleting `.delivery/`. Stamping this `learned:` frontmatter and leaving the scratch in place for the operator's console Close-line act.

**Step 6 — operator's reserved steps** (pointers only; the tickets above are the durable home):
- **Evolution board.** `handoff.md` §15 explicitly reserves creating the tracking project board to the operator ("the build does not create the project board... the operator creates the tracking surface after first ship"). Not created by this reconcile. Seed it with the Phase-2 backlog (`WPN-002`, `MAP2-002`, `SND-002`, `VFX-002`, `LDR-002` — check `build.md` for which are already implemented vs still open) plus the two `learn:` tickets above.
- **Acceptance demo / feedback capture.** The delivery gate was already signed before this phase (`build.md`, 2026-07-30, operator sign-off against the evidence chain) — reconcile does not re-run or re-sign it. Future customer feedback becomes new requirement IDs in the estimatekit project (slug `shoot4fun`), per the normal evolution loop.

**Step 7 — close.** This reconciles run `shoot4fun-2026-07-28` as done. No gate was signed or re-opened by this reconcile. Iterations from here are the ordinary CSD working loop (intent → build → ship), not a rerun of the five-phase delivery lifecycle; a materially new scope re-triggers scope/design phases additively, per `REF-Delivery.md` §1/§6, never by editing this frozen record.
