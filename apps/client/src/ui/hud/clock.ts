/* The match clock, as the HUD reads it.
 *
 * The server sends the seconds left in the round (`RoomSnapshot.time_remaining`);
 * this turns that scalar into the `M:SS` a player reads, and names the point
 * at which the end is near enough to warn about. Pure, so the formatting is
 * tested without a DOM: the HUD only writes the string it returns.
 */

/** Seconds left at or below which the match is "about to end" and the HUD
 * warns. */
export const ENDING_SECONDS = 30;

/** Format the seconds left in the match as `M:SS`.
 *
 * Counts by whole seconds the way a wall clock reads: a fractional second
 * still shows the second it is inside, so the display reaches `0:00` only when
 * the time is truly up, never a tick early. A past-deadline snapshot (a
 * negative remainder) clamps to zero. */
export function formatClock(secondsRemaining: number): string {
    const whole = Math.max(0, Math.ceil(secondsRemaining));
    const minutes = Math.floor(whole / 60);
    const seconds = whole % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
