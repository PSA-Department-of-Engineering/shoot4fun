/* Shop state: the catalog, the item being inspected, and the unlock flow.
 *
 * The screens are a small state machine over the session's menu screen:
 * catalog -> detail -> acquired, with the back paths the locked
 * interaction model fixes (detail->catalog, catalog->arsenal). Unlock is
 * the only mutation, and it lives on the detail screen alone.
 */

import { create } from "zustand";

import {
    acquireItem,
    fetchCatalog,
    type CatalogItem,
} from "@/net/shopApi";
import { loadArsenalFromServer } from "@/ui/viewmodels/arsenal/arsenal.state";

interface ShopState {
    items: CatalogItem[];
    loaded: boolean;
    loading: boolean;
    error: string | null;
    /** The item the detail screen shows. */
    selectedItemId: string | null;
    /** The item just unlocked; drives the Acquired screen's rig. */
    acquiredItemId: string | null;
    loadCatalog: () => Promise<void>;
    selectItem: (itemId: string) => void;
    /** Free-unlock the selected/owned item and refresh the Arsenal copy.
     *  Returns whether the acquisition landed (false when refused). */
    acquire: (itemId: string) => Promise<boolean>;
}

export const useShop = create<ShopState>()((set) => ({
    items: [],
    loaded: false,
    loading: false,
    error: null,
    selectedItemId: null,
    acquiredItemId: null,

    loadCatalog: async () => {
        if (useShop.getState().loading) return;
        set({ loading: true, error: null });
        try {
            const { items } = await fetchCatalog();
            set({ items, loaded: true, loading: false });
        } catch {
            set({
                loading: false,
                loaded: false,
                error: "The shop could not be reached. Try again shortly.",
            });
        }
    },

    selectItem: (itemId) => set({ selectedItemId: itemId }),

    acquire: async (itemId) => {
        try {
            const result = await acquireItem(itemId);
            // The server copy of the envelope now carries the ownership
            // record; refresh so the Arsenal inventory lists it.
            await loadArsenalFromServer();
            set({ acquiredItemId: itemId });
            return result.already_owned || result.equipped !== undefined;
        } catch {
            return false;
        }
    },
}));

export const selectSelectedItem = (s: ShopState): CatalogItem | null =>
    s.items.find((item) => item.id === s.selectedItemId) ?? null;

export const selectAcquiredItem = (s: ShopState): CatalogItem | null =>
    s.items.find((item) => item.id === s.acquiredItemId) ?? null;
