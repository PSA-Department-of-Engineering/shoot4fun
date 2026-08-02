/* The best score recorded for an arena, from `GET /api/leaderboard/{arena}`.
 *
 * `empty` is the 404 the API answers with before anyone has scored on a
 * map, which is an ordinary state and not a failure.
 */

export type LeaderboardStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface LeaderboardState {
    status: LeaderboardStatus;
    arena: string | null;
    holderName: string | null;
    bestScore: number | null;
}
