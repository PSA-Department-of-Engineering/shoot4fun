# Adversarial review — proposal, shoot4fun (attempt 2, third pass)

**Date:** 2026-07-28
**Kind:** scope
**Target:** `D:\Personal\shoot4fun\.delivery\proposal.md` (attempt 2, in-progress) and the `shoot4fun` estimation project on the running estimatekit instance
**Standard (`against=`):** `REF-Delivery.md` §1, §2; `REF-Estimatekit.md` §1–§7; the customer's verbatim ask in `data/requirements/00-customer-requirements.txt`
**Lenses (kind=scope):** meaningful-line-to-no-Req-ID, unpriced ask, silent scope drop, trace-back, unrecorded assumption, §4b honour, record/projection mismatch; plus the attempt-2-specific set: technology-swap coherence, effort preservation, audit/generation re-confirmation, re-open trail integrity, revision-log integrity, no silent re-scoping, no pre-asserted review verdict.

## Verbatim ask (verified unmodified)

`simple multiplayer threejs shooter` — one line, four meaningful tokens (`simple`, `multiplayer`, `threejs`, `shooter`).

## Audit re-run

`estimatekit_run_audit` returns **`passed: true`**, `passed_count: 90`, `failed_count: 0`, `skipped_count: 0`. Five warning-level suggestions (zero-design-lead, zero-testing-lag, thin-design, thin-qa, off-grid-allocation) — all severity `warning`, not failures, and the proposal record's "Auditor warnings noted, not blocking" section explains them.

## Attempt-2-specific checks

| Check | Result |
|---|---|
| Blocker (2nd review): "Review outcome" subsection narrates a passing verdict | **Resolved.** The subsection is now an honest placeholder pointing at the canonical review file. No pre-asserted verdict. |
| Blocker (1st review): stale Node.js on executive-summary slide | **Resolved.** `data/slides/executive-summary.tsv` `Rationale → Backend` row reads `Python (FastAPI) + uvicorn WebSocket server (asyncio tick loop, server-authoritative)`. Generated `output/slides/pages/02-executive-summary.md` reflects the same. No "Node.js" anywhere in the slide deck. |
| Blocker (1st review): false "no slide changes" claim in revision log | **Resolved.** The revision log self-acknowledges its first-pass error and notes the correction. |
| Non-blocking (2nd review): `DEP-001` "retitled" claim softened | **Resolved.** Record now correctly says only the body was updated; `PERF-001` is the one that was retitled. |
| Non-blocking (2nd review): P2 "1 month" speaker note | **Resolved.** P2 speaker note now says "2 months (18 MD across 2 months at 9 MD/month)", matching the resource plan. |
| Frontmatter (`attempt: 2`, `status: in-progress`, `signed: pending`, `reviewed: <empty>`, `mode: interactive`) | **Correct.** |
| Preserved attempt-1 review still on disk | **Confirmed** at `.delivery/reviews/proposal-2026-07-28-attempt-1.md`. |
| Technology-swap coherence across components, build activities, assumptions, and slides | **Coherent.** No `Node.js` anywhere; new stack uniformly Python/FastAPI/uvicorn/asyncio. |
| Effort preservation (P1 45 MD, P2 18 MD build) | **Preserved.** Unchanged from attempt 1. |
| No silent re-scoping | **None.** 17 Req IDs, same matrix, same `Original Text`. |

## Standard scope lenses

| Lens | Finding |
|---|---|
| Meaningful-line-to-no-Req-ID | None. Every meaningful token traces to one or more Req IDs. |
| Unpriced ask | None. |
| Silent scope drop | None. Descope list (10 items) is recorded in the proposal and mirrored in `DSCP-001`. |
| Trace-back | Every Req ID's `Original Text` is the verbatim one-line ask. |
| Unrecorded assumption | None. 11 assumptions, all linked to Req IDs, valid confidence/impact. |
| §4b honour | All six decisions recorded and honoured downstream. |
| Record/projection mismatch | None. |

## Findings (ranked most-severe first)

**No blockers. No non-blocking findings.**

The attempt-2 changes are correctly applied across the data files, build activities, assumptions, slides, and architecture diagrams. The "Review outcome" subsection is an honest placeholder. The revision log self-acknowledges its first-pass error. The speaker note reflects the 2-month P2 plan. The audit is green. The preserved attempt-1 review remains on disk and untouched. The record honestly reflects its state.

VERDICT: PASS
