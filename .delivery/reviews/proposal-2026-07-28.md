# Adversarial review — proposal, shoot4fun

**Date:** 2026-07-28
**Kind:** scope
**Target:** `D:\Personal\shoot4fun\.delivery\proposal.md` (this run's proposal record) and the `shoot4fun` estimation project on the running estimatekit instance
**Standard (`against=`):** `REF-Delivery.md` §2; `REF-Estimatekit.md` §1–§7; the customer's verbatim ask, preserved unmodified in `data/requirements/00-customer-requirements.txt`

## Lenses (kind=scope)

A meaningful line of the request that traces to no requirement ID; an unpriced ask; a silent scope drop; a requirement that does not survive back to the verbatim request. (Plus the unrecorded-assumption and §4b-honour lenses the skill names for every scope pass.)

## Verbatim ask (verified unmodified)

`simple multiplayer threejs shooter` — one line, four meaningful tokens (`simple`, `multiplayer`, `threejs`, `shooter`).

## Cross-checks

- Phase 1 = 12 reqs summing 45 MD build (P1-build.tsv: 3+5+3+4+3+2+5+4+4+3+2+4+3 = 45). Phase 2 = 5 reqs summing 18 MD build (P2-build.tsv: 1+3+3+2+3+3+2+1 = 18). 17 reqs total, 11 assumptions, 2 phases — matches `get_project_summary` and the proposal's own tables.
- Audit: `run_audit` returns **90 passed, 0 failed, 0 skipped** (`passed: true`). No `scaffold` sentinels remain; `brd` line-references resolve; `activity` coverage is intact per phase; `reverse` shows no scope creep; `architecture` diagrams exist for P1 and P2 and every phase component is depicted.
- Trace (token → Req ID): every meaningful token and every implicit need (`player`, `controls`, `place to play`, `hit detection`, `score`, `host/match`, `networking`) maps to a Req ID and a build activity. `DEP-001` is the one req that does not survive back to a token; the proposal-record flags it as `(derived; required to ship)` and the §4b decision `Registry / package visibility: public` plus the `PLAT-001` and `DEP-001` assumptions back the choice of the PSA Foundry.
- Build coverage: each phase-assigned Req ID has at least one build activity with non-zero effort, in the right phase (auditor confirms).
- Resource plan vs project effort: P1 Lead 5 covered by DM 2+2+1; Design 3 covered by SA 1+1+1; Dev 42 covered by TL 14+14+14. P2 Lead 2 covered by DM 1+1; Design 1 covered by SA 1+0; Dev 17 covered by TL 9+9 (capacity 18 ≥ effort 17).
- §4b decisions honoured: content language / license / visibility / infra window / security / quality bars are all recorded; the relevant ones are echoed in the assumptions and in the descope list. The descope list itself is a coverage claim and pairs with `SCOPE-001 HIGH/HIGH` and `DSCP-001 MEDIUM/LOW`.

## Findings (ranked most-severe first)

1. **Non-blocking — record/audit-state phrasing was stale.** `proposal.md:73` said `passed: true (53 passed, 0 failed; 37 roadmap checks skipped until generation, now satisfied)`. The state is **90 passed, 0 failed, 0 skipped**. *Resolved by editing the record to read `passed: true (90 passed, 0 failed, 0 skipped at scope-close)`.*
2. **Non-blocking — off-grid allocations not addressed in the record.** The auditor's `off-grid-allocation` warning names P1 DM (1, 2), P1 SA (1), P1 TL (14), P1 QA (1), and the same shape in P2. *Resolved by adding a "Warnings noted, not blocking" section to the record explaining the self-serve shape.*
3. **Non-blocking — `thin-design` / `zero-design-lead` / `zero-testing-lag` / `thin-qa` warnings not surfaced.** *Resolved in the same "Warnings noted, not blocking" section, with the QA-is-in-build explanation.*
4. **Non-blocking — `DEP-001` carries the PSA Foundry in its description but not in `Original Text`.** *Resolved by clarifying in the `DEP-001` row that the PSA Foundry pick is a §4b operator decision, not a customer ask.*
5. **Non-blocking — descope list lived in the proposal-record only, not in `02-assumptions.tsv`.** *Resolved by adding `DSCP-001` to the assumptions file, linking to `ALL`, mirroring the `SCOPE-001` shape.*
6. **Non-blocking — `client-side prediction` named in `BUILD-INT-001` but not in any assumption.** *Resolved by adding `ARCH-002` to the assumptions file with a confidence/impact rating.*
7. **Non-blocking — rate column carries `EUR 0` for every profile.** *Resolved by adding `COM-001` to the assumptions file explaining the self-serve zero rate.*

## Blockers

**None.** The audit is green, every meaningful token in the verbatim ask traces to a Req ID, every Req ID has a build activity with non-zero effort, every phase is covered by a resource plan, and the §4b decisions are recorded (the descope list is explicit, not silent). The seven items above are completeness and freshness observations, and all were resolved before the gate closed.

VERDICT: PASS
