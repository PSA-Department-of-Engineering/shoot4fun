/* Leaderboard actions. The one HTTP call in the client. */

import { create } from "zustand";

import type { LeaderboardState } from "./leaderboard.state";

interface LeaderboardActions {
    load: (arena: string) => Promise<void>;
}

interface LeaderboardPayload {
    holder_name?: string;
    best_score?: number;
}

export const useLeaderboard = create<LeaderboardState & LeaderboardActions>()((set) => ({
    status: "idle",
    arena: null,
    holderName: null,
    bestScore: null,

    load: async (arena) => {
        set({ status: "loading", arena, holderName: null, bestScore: null });
        try {
            const response = await fetch(`/api/leaderboard/${encodeURIComponent(arena)}`);
            if (response.status === 404) {
                set({ status: "empty" });
                return;
            }
            if (!response.ok) {
                set({ status: "error" });
                return;
            }
            const payload = (await response.json()) as LeaderboardPayload;
            set({
                status: "ready",
                holderName: payload.holder_name ?? null,
                bestScore: payload.best_score ?? null,
            });
        } catch {
            set({ status: "error" });
        }
    },
}));
