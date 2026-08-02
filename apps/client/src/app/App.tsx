import { selectPhase as selectMatchPhase, useRoom } from "@/ui/viewmodels/room";
import { selectPhase as selectJoinPhase, useSession } from "@/ui/viewmodels/session";
import { SettingsDialog } from "@/ui/views/organisms/SettingsDialog";
import EntryPage from "@/ui/views/pages/EntryPage";
import LobbyPage from "@/ui/views/pages/LobbyPage";
import MatchPage from "@/ui/views/pages/MatchPage";
import ResultsPage from "@/ui/views/pages/ResultsPage";

import { HudLayer } from "./HudLayer";
import { SceneStage } from "./SceneStage";

/* The shell.
 *
 * There is no router: the screen is a function of two facts the server
 * and the socket own, whether this browser is in a room and what that
 * room is doing. The scene and the HUD sit underneath every screen and
 * are never unmounted, so a match keeps running while a menu is up.
 */
const App = () => {
    const joinPhase = useSession(selectJoinPhase);
    const matchPhase = useRoom(selectMatchPhase);

    return (
        <>
            <SceneStage />
            <HudLayer />
            {joinPhase !== "joined" ? (
                <EntryPage />
            ) : matchPhase === "playing" ? (
                <MatchPage />
            ) : matchPhase === "results" ? (
                <ResultsPage />
            ) : (
                <LobbyPage />
            )}
            <SettingsDialog />
        </>
    );
};

export default App;
