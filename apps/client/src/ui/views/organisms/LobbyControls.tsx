import {
    MIN_PLAYERS_TO_START,
    selectAllReady,
    selectCanStart,
    selectIsHost,
    selectIsReady,
    selectPlayerCount,
    useRoom,
} from "@/ui/viewmodels/room";

import { Button } from "../atoms/Button";

/* The two decisions a lobby holds: whether you are ready, and whether the
 * host starts. Start belongs to the host and the server enforces that, so
 * nobody else is shown a control that would be refused. */
export const LobbyControls = () => {
    const isHost = useRoom(selectIsHost);
    const isReady = useRoom(selectIsReady);
    const canStart = useRoom(selectCanStart);
    const allReady = useRoom(selectAllReady);
    const playerCount = useRoom(selectPlayerCount);
    const toggleReady = useRoom((s) => s.toggleReady);
    const startMatch = useRoom((s) => s.startMatch);

    const blocker =
        playerCount < MIN_PLAYERS_TO_START
            ? `${MIN_PLAYERS_TO_START} players needed`
            : !allReady
              ? "Everyone has to be ready"
              : null;

    return (
        <div className="controls">
            <Button
                variant={isReady ? "secondary" : "primary"}
                onClick={toggleReady}
                data-ready
            >
                {isReady ? "Not ready" : "Ready up"}
            </Button>

            {isHost ? (
                <Button variant="primary" disabled={!canStart} onClick={startMatch} data-start>
                    Start match
                </Button>
            ) : null}

            {isHost && blocker ? <span className="controls__note">{blocker}</span> : null}
            {!isHost ? (
                <span className="controls__note">Waiting for the host to start</span>
            ) : null}
        </div>
    );
};
