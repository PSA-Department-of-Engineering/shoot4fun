# ADR 0004: Client prediction, and holding two simulations in agreement

- **Status:** Accepted
- **Date:** 2026-08-02
- **Decision drivers:** `ARCH-002`, `PERF-001`, and `ADR-0003`, which is
  not playable without this.

## Context

`ADR-0003` puts the simulation on the server. Applied literally, a
keypress travels to the server, waits a tick, and travels back before
the player sees themselves move. At 40ms round trip that is a sluggish
game; at 150ms it is an unusable one. Every shipped online shooter
answers this the same way, with three mechanisms:

- **Prediction.** The client applies its own input immediately, using
  the same rules the server will apply.
- **Reconciliation.** Each snapshot carries the sequence number of the
  last input the server consumed. The client snaps to the authoritative
  position and replays the inputs the server has not seen yet. When
  client and server agree, the correction is zero and invisible.
- **Interpolation.** Other players are rendered slightly in the past,
  from a buffer of snapshots, so 20Hz updates read as continuous motion
  instead of teleporting.

Prediction has a structural cost, and it is the reason this is an ADR
rather than an implementation note: the client must run the same
movement and collision rules as the server. The server is Python and
the client is TypeScript, so those rules exist twice, in two languages,
which the engineering playbook forbids by default. Duplication with
intent to maintain in parallel is the first universal violation, and
the rule's own escape clause is the standard to meet: propagation must
be mechanical, or the copy must not be made.

## Decision

Predict on the client, and make the agreement between the two
simulations mechanically enforced rather than maintained by discipline.

- The movement and collision rules live in **one small, pure,
  side-effect-free routine on each side**: given a position, an input
  frame, and the arena, return the next position. No networking, no
  rendering, no room state.
- A **golden trace fixture** is committed once and read by both test
  suites: a list of arenas, start positions, and input sequences, each
  with the exact positions the routine must produce.
- The Python suite replays the trace against the server routine. The
  TypeScript suite replays the same file against the client routine.
  Any divergence fails both suites, naming the first differing step.
- The fixture is **generated from the server routine**, which is the
  authority, and regenerating it is a deliberate committed act that
  shows up as a diff. The client can never be the reason the fixture
  changes.

This is the "propagation must be mechanical" clause honoured: the two
implementations are not kept in sync by review, they are kept in sync
by a shared artifact that fails the build the moment they disagree.

## Consequences

- **The game feels immediate** at any ping the connection can carry,
  while the server remains the authority (`ADR-0003`).
- **Two implementations exist, deliberately and visibly**, with the
  ADR and the fixture as the record of why.
- **The movement routine is constrained by this decision.** It must
  stay pure and small enough to be worth writing twice. Anything that
  cannot be expressed that way (weapon state, scoring, match flow) is
  server-only and is not predicted, which is the correct default.
- **Floating-point agreement is a real risk** across languages. The
  trace compares within a tight epsilon rather than bit-exactly, and
  the routine avoids operations whose results are platform-dependent.
- **Mispredictions are visible in one place.** When the correction
  after replay exceeds a threshold, the client can log it, which makes
  desync a measurable quantity rather than a feeling.

## Alternatives considered

- **No prediction; render the server snapshot directly.** Honest,
  trivially consistent, and unplayable above a local connection.
  Rejected.
- **Move the whole server to TypeScript** so one routine serves both
  sides. It genuinely removes the duplication, and it discards the
  hexagonal Python service, its tests, its container, and its
  deployment. Rejected as disproportionate to the problem, but this is
  the alternative to revisit if the shared surface ever grows beyond a
  single movement routine.
- **Generate the client routine from the Python source.** A transpiler
  step for one function, with a build dependency and a debugging story
  worse than the duplication it removes. Rejected.
- **Trust the client's predicted position** and skip reconciliation.
  That is `ADR-0003`'s superseded shape wearing new words. Rejected.
