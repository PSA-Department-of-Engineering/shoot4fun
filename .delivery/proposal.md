---
phase: scope
skill: deliver-engagement
status: in-progress
gate: proposal
signed: pending
reviewed:
run: shoot4fun-2026-07-28
attempt: 1
mode: interactive
started: 2026-07-28T00:00:00Z
finished:
credential_ref: estimatekit-mcp
---

# Proposal — shoot4fun

## Customer request (verbatim)

> simple multiplayer threejs shooter

Original language: English. Preserved without paraphrase, per `REF-Delivery.md` §2.

## Engagement identity

| Field | Value |
| --- | --- |
| Name | Shoot4Fun |
| Slug | `shoot4fun` |
| Customer | Self (Carlos Dias) — self-serve, operator signs the four gates |
| Target hostname | `shoot4fun.chaos-architect.dev` |
| Repo | `https://github.com/PSA-Department-of-Engineering/shoot4fun` |
| Local path | `D:\Personal\shoot4fun` |

## §4b operator decisions (recorded)

| Decision | Value |
| --- | --- |
| Content language | English |
| License | MIT (permissive) |
| Registry / package visibility | public |
| Infrastructure availability window | opportunistic, no SLA |
| Security / data classification | public-by-design (no PII, no secrets) |
| Quality bars | best-effort; browser matrix = modern evergreen |

## Gate signer

Operator (self-serve). One signer for all four gates; the trail records the same
either way (`REF-Delivery.md` §1).

## Run mode

`mode=interactive`. This skill hands the operator the next command at each gate;
the four phases after Scope run in fresh sessions, joined by artifacts, not memory.

## Estimation project

A live estimatekit project backs this scope. The proposal record points at it;
**it does not copy its contents** (`REF-Delivery.md` §1, anti-pattern #2 in
`REF-Estimatekit.md` §8).

| Field | Value |
| --- | --- |
| Estimatekit instance | `https://estimatekit.chaos-architect.dev` |
| Project slug | `shoot4fun` |
| API | `POST /api/projects/shoot4fun/audit`, `POST /api/projects/shoot4fun/generate` |
| Deck URL | `https://estimatekit.chaos-architect.dev/projects/shoot4fun/slides/` |

## Requirement spine

(Filled after Step 1 — Scope. Req IDs minted by the estimatekit audit become the
traceability spine for design, intent, and build. The `derived_from` linkage in
each intent claim (`REF-Delivery.md` §4a) points back here.)

| Category | Req ID | Description | Phase |
| --- | --- | --- | --- |
| _populated after `run_audit` returns `passed: true`_ | | | |

## Adversarial review

(Filled after the scope's fresh-eyes review.)

## Proposal gate

The proposal gate closes when the customer accepts the estimate and quote. In a
self-serve engagement the operator accepts; the trail records the same.

| Field | Value |
| --- | --- |
| Status | `gate` once the record is in gate-ready form |
| Signed | date the operator accepts (helper-stamped) |
| Reviewed | date the scope's fresh-eyes review passed (helper-stamped) |

This record is the only artifact of the scope phase. `.delivery/proposal.md` is
ephemeral: drained by `reconcile-delivery` when the run closes (§1).
