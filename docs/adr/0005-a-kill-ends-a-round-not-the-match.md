# ADR 0005: A kill ends a round of the fight, not the match (SCO-001)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Decision drivers:** `SCO-001`, attested by `INT-010`; resolves a
  contradiction with `INT-005`.

## Context

Two recorded claims disagreed about what a death means, and the
disagreement was invisible because each was individually true of the
code.

`INT-010` says the match ends when the timer expires or fewer than two
players are alive. `INT-005` says a dead player respawns after three
seconds, and gives as its reason that respawn "is the loop that keeps a
match playable past one death; without it the match ends on the first
kill."

Both were implemented. The end condition was evaluated the instant hit
points reached zero, and the respawn timer started at that same instant,
so the end condition always won. In a two-player room, which is the
smallest a match can be and the commonest one a pair of players will
make, the first kill ended the match. The respawn loop, the three second
countdown, the spawn-point-away-from-the-living picker and the eight
minute clock were all built, all tested, and all unreachable.

The reading that produced this is that "alive" is a property of the
current instant. Under that reading a player who is mid-respawn is
indistinguishable from a player who has left.

## Decision

A kill ends a round of the fight. Only two things end a match:

- **The clock.** `MATCH_DURATION_SECONDS` expires and the highest kill
  count wins, ties breaking on the first counted kill.
- **The room emptying.** Fewer than two players remain connected, at
  which point there is no longer a match to play (`INT-008` fixes the
  floor at two).

Death is a transition, not an exit. A player at zero hit points holds a
running respawn timer and is counted as present, so the population that
decides whether a match can continue is who is in the room, not who is
standing.

The condition is therefore evaluated on the simulation tick, where both
the clock and the player roster live. It is no longer evaluated when a
shot lands, because nothing an input frame carries can change either.

## Consequences

- **The systems the game already had start working.** Respawn, the
  countdown, spawn placement away from the living and the match timer
  are all now reachable in a two-player match.
- **A two-player match runs to the clock**, and the winner is decided by
  kill count rather than by who shot first.
- **A disconnect ends the match promptly**, which the previous condition
  did not do: it required two or more players before it would consider
  ending, so a player left alone kept playing against nobody.
- **Eight minutes is now the real length of a match.** It was previously
  a ceiling almost nothing reached. Whether that is the right number is
  a separate question this ADR does not answer; a kill target that ends
  the match early is the obvious follow-on if it plays long.
- **`INT-010`'s statement is corrected** to say what ends a match, since
  its previous wording is what encoded the contradiction.

## Alternatives considered

- **Keep last-man-standing and delete respawn.** Coherent, and a
  different game: elimination rounds rather than deathmatch. Rejected
  because respawn, the kill counter, the eight minute clock and a
  results screen that sorts by kills all describe a deathmatch, so
  respawn was not the odd one out.
- **Last-man-standing above a player threshold**, elimination at 3 or 4
  players and deathmatch at 2. Rejected: one match rule the player can
  learn beats a rule that changes shape with the lobby size.
- **End on a kill target instead of the clock.** Not rejected, deferred:
  it is a tuning decision that needs the game played, and it composes
  with this rather than replacing it.
