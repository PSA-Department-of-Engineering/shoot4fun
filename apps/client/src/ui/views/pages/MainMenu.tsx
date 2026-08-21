import { useState } from "react";

import { useSession } from "@/ui/viewmodels/session";

import { AccountPanel } from "../organisms/AccountPanel";
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
 * dead links. Versus opens the existing room/lobby flow; Practice opens
 * the existing solo range; Arsenal (issue #41) opens the Arsenal view. */
const MainMenu = () => {
    const enterSolo = useSession((s) => s.enterSolo);
    const enterArsenal = useSession((s) => s.enterArsenal);
    const [panel, setPanel] = useState<"versus" | null>(null);

    const select = (tile: MenuTile): void => {
        if (tile.status === "soon") return;
        switch (tile.id) {
            case "versus":
                setPanel("versus");
                break;
            case "practice":
                enterSolo();
                break;
            case "arsenal":
                enterArsenal();
                break;
            // survival and shop are "soon": disabled above, never reach here.
        }
    };

    const renderTile = (tile: MenuTile) => (
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
    );

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
                <>
                    <section className="menu-group">
                        <h2 className="menu-group__title">Modes</h2>
                        <div className="menu-modes">
                            {MENU_TILES.filter((t) => t.group === "mode").map(renderTile)}
                        </div>
                    </section>
                    <section className="menu-group">
                        <h2 className="menu-group__title">Store</h2>
                        <div className="menu-stores">
                            {MENU_TILES.filter((t) => t.group === "store").map(renderTile)}
                        </div>
                    </section>
                </>
            )}
        </MenuTemplate>
    );
};

export default MainMenu;
