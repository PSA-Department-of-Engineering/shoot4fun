import { selectPhase as selectMatchPhase, useRoom } from "@/ui/viewmodels/room";
import {
    selectPhase as selectJoinPhase,
    selectSolo,
    selectScreen,
    useSession,
} from "@/ui/viewmodels/session";
import { SettingsDialog } from "@/ui/views/organisms/SettingsDialog";
import { AccountDialog } from "@/ui/views/organisms/AccountDialog";
import LaunchScreen from "@/ui/views/pages/LaunchScreen";
import LobbyPage from "@/ui/views/pages/LobbyPage";
import MainMenu from "@/ui/views/pages/MainMenu";
import MatchPage from "@/ui/views/pages/MatchPage";
import ResultsPage from "@/ui/views/pages/ResultsPage";
import SoloPage from "@/ui/views/pages/SoloPage";
import Arsenal from "@/ui/views/pages/Arsenal";
import ShopCatalog from "@/ui/shop/ShopCatalog";
import ShopItemDetail from "@/ui/shop/ShopItemDetail";
import ShopAcquired from "@/ui/shop/ShopAcquired";

import { HudLayer } from "./HudLayer";
import { SceneStage } from "./SceneStage";

/* The shell.
 *
 * There is no router: the screen is a function of two facts the server
 * and the socket own, whether this browser is in a room and what that
 * room is doing. In front of a room sits the pre-game menu (issue #42):
 * a launch screen that picks guest-vs-login, then the growable main
 * menu both choices land on. The scene and the HUD sit underneath every
 * screen and are never unmounted, so a match keeps running while a menu
 * is up.
 */
const App = () => {
    const joinPhase = useSession(selectJoinPhase);
    const solo = useSession(selectSolo);
    const menuScreen = useSession(selectScreen);
    const matchPhase = useRoom(selectMatchPhase);

    return (
        <>
            <SceneStage />
            <HudLayer />
            {solo ? (
                // The solo range stands apart from the room state machine
                // (issue #15): it owns the screen while it is on.
                <SoloPage />
            ) : joinPhase !== "joined" ? (
                // No room yet: the launch screen, then the main menu and
                // its store surfaces.
                menuScreen === "launch" ? (
                    <LaunchScreen />
                ) : menuScreen === "arsenal" ? (
                    <Arsenal />
                ) : menuScreen === "shop-catalog" ? (
                    <ShopCatalog />
                ) : menuScreen === "shop-item" ? (
                    <ShopItemDetail />
                ) : menuScreen === "shop-acquired" ? (
                    <ShopAcquired />
                ) : (
                    <MainMenu />
                )
            ) : matchPhase === "playing" ? (
                <MatchPage />
            ) : matchPhase === "results" ? (
                <ResultsPage />
            ) : (
                <LobbyPage />
            )}
            <SettingsDialog />
            <AccountDialog />
        </>
    );
};

export default App;
