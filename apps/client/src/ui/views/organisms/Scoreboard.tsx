import { useMemo } from "react";

import { rankPlayers, selectSnapshot, useRoom } from "@/ui/viewmodels/room";

import { ScoreRow } from "../molecules/ScoreRow";

/* How the match went, ordered by kills and broken by fewer deaths. */
export const Scoreboard = () => {
    const snapshot = useRoom(selectSnapshot);
    const localPlayerId = useRoom((s) => s.localPlayerId);
    const ranking = useMemo(() => rankPlayers(snapshot), [snapshot]);

    return (
        <section className="panel">
            <h2 className="panel__title">Scoreboard</h2>
            <ul className="scoreboard">
                {ranking.map((player, index) => (
                    <ScoreRow
                        key={player.id}
                        place={index + 1}
                        name={player.name}
                        team={player.team}
                        kills={player.kills}
                        deaths={player.deaths}
                        isYou={player.id === localPlayerId}
                    />
                ))}
            </ul>
        </section>
    );
};
