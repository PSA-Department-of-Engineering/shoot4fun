/* The menu's shape as data (issue #42).
 *
 * Adding a mode or a store is an entry here; the grid that renders it
 * lives in MainMenu and is not rewritten when a tile is added. Tiles
 * that are not built yet ship as disabled placeholders, so the menu
 * shows the game's full shape without ever offering a dead link. */

export type MenuTileId = "versus" | "training" | "coop" | "arsenal" | "shop";
export type MenuTileStatus = "ready" | "soon";

export interface MenuTile {
    id: MenuTileId;
    title: string;
    caption: string;
    status: MenuTileStatus;
}

export const MENU_TILES: MenuTile[] = [
    {
        id: "versus",
        title: "Versus",
        caption: "Open a room or join one. Up to you and the lobby.",
        status: "ready",
    },
    {
        id: "training",
        title: "Training",
        caption: "Solo aim range. Warm up before you queue.",
        status: "ready",
    },
    {
        id: "coop",
        title: "Coop",
        caption: "Survive the wave with a friend. Not built yet.",
        status: "soon",
    },
    {
        id: "arsenal",
        title: "Arsenal",
        caption: "Your loadout and weapon unlocks (#41).",
        status: "ready",
    },
    {
        id: "shop",
        title: "Shop",
        caption: "Skins, cases and cosmetics. Coming later.",
        status: "soon",
    },
];
