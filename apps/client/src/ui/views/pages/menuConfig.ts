/* The menu's shape as data (issue #42).
 *
 * Adding a mode or a store is an entry here; the grid that renders it
 * lives in MainMenu and is not rewritten when a tile is added. Tiles
 * that are not built yet ship as disabled placeholders, so the menu
 * shows the game's full shape without ever offering a dead link. */

export type MenuTileId = "versus" | "practice" | "survival" | "arsenal" | "shop";
export type MenuTileStatus = "ready" | "soon";
export type MenuTileGroup = "mode" | "store";

export interface MenuTile {
    id: MenuTileId;
    title: string;
    caption: string;
    status: MenuTileStatus;
    group: MenuTileGroup;
}

export const MENU_TILES: MenuTile[] = [
    {
        id: "versus",
        title: "Versus",
        caption: "Open a room or join one. Up to you and the lobby.",
        status: "ready",
        group: "mode",
    },
    {
        id: "practice",
        title: "Practice",
        caption: "Solo aim range. Drill movement and accuracy at your own pace.",
        status: "ready",
        group: "mode",
    },
    {
        id: "survival",
        title: "Survival",
        caption: "Endless waves, alone or with a friend. Not built yet.",
        status: "soon",
        group: "mode",
    },
    {
        id: "arsenal",
        title: "Arsenal",
        caption: "Your loadout, weapons and unlocks.",
        status: "ready",
        group: "store",
    },
    {
        id: "shop",
        title: "Shop",
        caption: "Skins and cosmetics. Unlock and apply to your rig.",
        status: "ready",
        group: "store",
    },
];
