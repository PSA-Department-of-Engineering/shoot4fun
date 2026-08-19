import { useState } from "react";

import { useSession } from "@/ui/viewmodels/session";

import { Button } from "../atoms/Button";
import { cx } from "../cx";
import { JoinPanel } from "../organisms/JoinPanel";
import { Wordmark } from "../atoms/Wordmark";
import { MenuTemplate } from "../templates/MenuTemplate";
import { MENU_TILES, type MenuTile } from "./menuConfig";

/* The growable front door (issue #42).
 *
 * Every mode and store the game will ever offer is one entry in
 * `MENU_TILES`; the grid below is rendered from that list and is never
 * rewritten when a tile is added. Tiles that are not built yet render
 * as disabled placeholders, so the menu shows the game's shape without
 * dead links. Versus opens the existing room/lobby flow; Training opens
 * the existing solo range. */
const MainMenu = () => {
    const enterSolo = useSession((s) => s.enterSolo);
    const [panel, setPanel] = useState<"versus" | null>(null);

    const select = (tile: MenuTile): void => {
        if (tile.status === "soon") return;
        switch (tile.id) {
            case "versus":
                setPanel("versus");
                break;
            case "training":
                enterSolo();
                break;
            // coop, arsenal and shop are "soon": disabled above, never reach here.
        }
    };

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
