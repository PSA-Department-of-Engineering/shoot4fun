import { useEffect } from "react";

import { useLeaderboard } from "@/ui/viewmodels/leaderboard";

interface BestScorePanelProps {
    /** The arena whose record to show. */
    arenaId: string;
    arenaName: string;
}

/* The standing record for this map, from the server. It is one row
 * because the API keeps one: the best score an arena has seen. */
export const BestScorePanel = ({ arenaId, arenaName }: BestScorePanelProps) => {
    const status = useLeaderboard((s) => s.status);
    const holderName = useLeaderboard((s) => s.holderName);
    const bestScore = useLeaderboard((s) => s.bestScore);
    const load = useLeaderboard((s) => s.load);

    useEffect(() => {
        if (arenaId) void load(arenaId);
    }, [arenaId, load]);

    return (
        <section className="panel">
            <h2 className="panel__title">
                Record
                <span className="panel__count">{arenaName}</span>
            </h2>
            {status === "ready" ? (
                <p className="record">
                    <strong className="record__holder">{holderName}</strong>
                    <span className="record__score">{bestScore} kills</span>
                </p>
            ) : (
                <p className="panel__empty">
                    {status === "loading"
                        ? "Loading"
                        : status === "empty"
                          ? "No record on this map yet"
                          : "The record is out of reach"}
                </p>
            )}
        </section>
    );
};
