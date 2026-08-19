import { useState } from "react";

import { useSession } from "@/ui/viewmodels/session";

import { Button } from "../atoms/Button";
import { cx } from "../cx";
import { JoinPanel } from "../organisms/JoinPanel";
import { AccountPanel } from "../organisms/AccountPanel";
import { Wordmark } from "../atoms/Wordmark";
import { MenuTemplate } from "../templates/MenuTemplate";
import { MENU_TILES, type MenuTile } from "./menuConfig";
import Arsenal from "./Arsenal";

/* The growable front door (issue #42).
 *
 * Every mode and store the game will ever offer is one entry in
 * `MENU_TILES`; the grid below is rendered from that list and is never
 * rewritten when a tile is added. Tiles that are not built yet render
 * as disabled placeholders, so the menu shows the game's shape without
 * dead links. Versus opens the existing room/lobby flow; Training opens
 * the existing solo range; Arsenal (issue #41) opens the Arsenal view.
 *
 * The `AccountPanel` is mounted here so opt-in login is reachable from the
 * menu without ever gating play (LOGIN-001/002): a guest simply has no
 * account actions to take and play proceeds. */
const MainMenu = () => {
    const enterSolo = useSession((s) => s.enterSolo);
    const [panel, setPanel] = useState<"versus" | "arsenal" | null>(null);

    const select = (tile: MenuTile): void => {
        if (tile.status === "soon") return;
        switch (tile.id) {
            case "versus":
                setPanel("versus");
                break;
            case "training":
                enterSolo();
                break;
            case "arsenal":
                setPanel("arsenal");
                break;
            // coop and shop are "soon": disabled above, never reach here.
        }
    };

    // The Arsenal view is its own full screen (its own MenuTemplate, back
    // button, and AccountPanel-free surface), so it replaces the menu rather
    // than nesting inside it. Its back button returns to the menu (the tiles).
    if (panel === "arsenal") return <Arsenal onBack={() => setPanel(null)} />;

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <Wordmark>SHOOT4FUN</Wordmark>
                    <p className="menu__lead">
                        Pick a mode. Your room, your range, your loadout.
                    </p>
                </>
            }
            footer={<AccountPanel />}
        >
            {panel === "versus" ? (
                <div className="panel">
                    <Button
                        variant="ghost"
                        onClick={() => setPanel(null)}
                        data-menu-back
                    >
                        &larr; Back to menu
                    </Button>
                    <JoinPanel />
                </div>
            ) : (
                <div className="menu-tiles">
                    {MENU_TILES.map((tile) => (
                        <button
                            key={tile.id}
                            type="button"
                            className={cx(
                                "menu-tile",
                                tile.status === "soon" && "menu-tile--soon",
                            )}
                            disabled={tile.status === "soon"}
                            onClick={() => select(tile)}
                            data-tile={tile.id}
                            data-tile-status={tile.status}
                        >
                            <span className="menu-tile__title">{tile.title}</span>
                            <span className="menu-tile__caption">{tile.caption}</span>
                            {tile.status === "soon" ? (
                                <span className="menu-tile__badge">Coming soon</span>
                            ) : null}
                        </button>
                    ))}
                </div>
            )}
        </MenuTemplate>
    );
};

export default MainMenu;
