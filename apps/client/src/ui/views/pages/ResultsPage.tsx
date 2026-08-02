import {
    selectArenaId,
    selectArenaName,
    selectIsHost,
    selectWinnerName,
    useRoom,
} from "@/ui/viewmodels/room";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";
import { BestScorePanel } from "../organisms/BestScorePanel";
import { Scoreboard } from "../organisms/Scoreboard";
import { MenuTemplate } from "../templates/MenuTemplate";

/* How it ended, and the one way onward: the host calls a rematch and the
 * room returns to its lobby. */
const ResultsPage = () => {
    const winnerName = useRoom(selectWinnerName);
    const isHost = useRoom(selectIsHost);
    const arenaId = useRoom(selectArenaId);
    const arenaName = useRoom(selectArenaName);
    const rematch = useRoom((s) => s.rematch);

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <Wordmark>MATCH OVER</Wordmark>
                    <p className="menu__lead">
                        {winnerName ? `${winnerName} takes it` : "Nobody took it"}
                    </p>
                </>
            }
            footer={
                isHost ? (
                    <Button variant="primary" onClick={rematch} data-rematch>
                        Rematch
                    </Button>
                ) : (
                    <span className="controls__note">Waiting for the host to rematch</span>
                )
            }
        >
            <div className="menu__columns">
                <Scoreboard />
                <BestScorePanel arenaId={arenaId} arenaName={arenaName} />
            </div>
        </MenuTemplate>
    );
};

export default ResultsPage;
