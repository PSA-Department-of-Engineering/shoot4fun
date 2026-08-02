import { useEffect } from "react";

import { selectArenaId, selectIsHost, useRoom } from "@/ui/viewmodels/room";

import { MapOption } from "../molecules/MapOption";

/* The map the match will be played on. The server owns both the set of
 * arenas and the choice, so this panel asks for the catalogue and then
 * asks the room to change: every screen in it changes together when the
 * answer comes back. */
export const ArenaPanel = () => {
    const arenaId = useRoom(selectArenaId);
    const isHost = useRoom(selectIsHost);
    const arenas = useRoom((s) => s.arenas);
    const selectArena = useRoom((s) => s.selectArena);
    const loadArenas = useRoom((s) => s.loadArenas);

    useEffect(() => {
        void loadArenas();
    }, [loadArenas]);

    return (
        <section className="panel">
            <h2 className="panel__title">
                Map
                {!isHost ? <span className="panel__count">host picks</span> : null}
            </h2>
            <div className="map-grid" role="radiogroup" aria-label="Map">
                {arenas.map((option) => (
                    <MapOption
                        key={option.id}
                        groupName="arena"
                        value={option.id}
                        name={option.name}
                        blurb={option.blurb}
                        selected={option.id === arenaId}
                        disabled={!isHost}
                        onSelect={selectArena}
                    />
                ))}
            </div>
        </section>
    );
};
