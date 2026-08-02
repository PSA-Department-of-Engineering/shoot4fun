import { useMemo } from "react";

import {
    listPlayers,
    ROOM_CAPACITY,
    selectSnapshot,
    useRoom,
} from "@/ui/viewmodels/room";

import { PlayerRow } from "../molecules/PlayerRow";

/* Who is in the room and who the room is waiting on. Empty seats are
 * drawn rather than left out: a lobby of one should look like a lobby
 * missing three, not like a finished list. */
export const RosterPanel = () => {
    const snapshot = useRoom(selectSnapshot);
    const localPlayerId = useRoom((s) => s.localPlayerId);
    const players = useMemo(() => listPlayers(snapshot), [snapshot]);
    const hostId = snapshot?.host_id ?? "";
    const emptySeats = Math.max(0, ROOM_CAPACITY - players.length);

    return (
        <section className="panel">
            <h2 className="panel__title">
                Players
                <span className="panel__count">
                    {players.length} / {ROOM_CAPACITY}
                </span>
            </h2>
            <ul className="roster">
                {players.map((player) => (
                    <PlayerRow
                        key={player.id}
                        name={player.name}
                        team={player.team}
                        isHost={player.id === hostId}
                        isReady={player.is_ready}
                        isYou={player.id === localPlayerId}
                    />
                ))}
                {Array.from({ length: emptySeats }, (_, index) => (
                    <li className="player-row player-row--empty" key={`seat-${index}`}>
                        Open seat
                    </li>
                ))}
            </ul>
        </section>
    );
};
