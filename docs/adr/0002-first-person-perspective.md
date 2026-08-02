# ADR 0002: First-person perspective (CAM-001)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Decision drivers:** `CAM-001`, attested by `INT-002`.

## Context

A shooter's perspective governs its input model, its aiming model, its
hit resolution, its character art budget, and its level design. First
person, third person and isometric are three different games built from
the same domain.

`INT-002` assumes a first-person camera and the HUD ships a centre
crosshair, but no decision record fixed the perspective. An assumption
carried only by a claim statement and a crosshair is not a decision: it
leaves the local avatar rendered at the camera position (the player
views the world from inside their own head), and it leaves every
downstream question, such as whether the aim ray originates at the eye
or at a camera boom, unanswered.

## Decision

The game is first person.

- The camera sits at eye height on the player's rig and carries the
  player's yaw and pitch directly.
- The aim ray originates at the eye and runs along the camera forward
  vector. The crosshair marks that ray, so what the crosshair covers is
  what the ray tests.
- The local player's own avatar is not rendered for the local player. It
  is rendered for everyone else.
- Pitch is clamped short of vertical so the camera cannot flip.

## Consequences

- **Aim and camera are the same thing.** There is no separate aim
  direction to reconcile against a character facing, which is what a
  third-person build would owe.
- **Character art serves other players, not the holder.** The rig is
  seen by opponents only, so animation quality is a spectator concern
  and a viewmodel (the weapon in the holder's own view) is a separate,
  optional piece of work.
- **Level design owes sightlines at eye height.** Cover that reads from
  a third-person camera does not necessarily read from 1.6m.
- **Pointer lock is mandatory.** First-person mouse-look requires
  relative mouse deltas, which the browser supplies only under pointer
  lock (`ADR-0004`).

## Alternatives considered

- **Third person over the shoulder.** More readable, more forgiving,
  and more expensive: a spring arm, camera collision against cover, and
  a split between where the character faces and where the shot goes.
  Rejected as a different game from the one scoped.
- **Isometric or twin-stick.** Easiest to make feel good and to
  network, needs no pointer lock at all. Rejected on the same ground.
