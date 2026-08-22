/* The Arsenal data shape, client side (ARS-004, ADR-0007).
 *
 * Local-first: the Arsenal view binds to the same versioned envelope the
 * server stores, so the shop line's acquisitions drop into a structure
 * already present. The envelope keeps an opaque `data` object, so fields a
 * future that adds (outfits, stats, unlocks) survive untouched. This store
 * now also reads the server copy (the shop writes it), merging nothing:
 * the server is the source of truth for a signed-in session, the empty
 * default stands in when there is none.
 */

import { create } from "zustand";

import { fetchArsenal } from "@/net/accountApi";
import { inventoryEntryIds } from "@/ui/viewmodels/arsenal/arsenal.model";

export interface ArsenalEnvelope {
    version: number;
    data: {
        model?: string;
        inventory?: unknown[];
        [key: string]: unknown;
    };
}

/** The empty starting shape: the robot rig, with nothing in the loadout yet. */
export const DEFAULT_ARSENAL: ArsenalEnvelope = {
    version: 1,
    data: { model: "robot", inventory: [] },
};

function asEnvelope(raw: unknown): ArsenalEnvelope | null {
    if (typeof raw !== "object" || raw === null) return null;
    const candidate = raw as ArsenalEnvelope;
    if (
        typeof candidate.version !== "number" ||
        typeof candidate.data !== "object" ||
        candidate.data === null
    ) {
        return null;
    }
    return candidate;
}

interface ArsenalState {
    envelope: ArsenalEnvelope;
    /** Pull `GET /api/account/arsenal` into the envelope. A failure (no
     *  session, offline) leaves the current envelope standing - the view
     *  renders gracefully either way. */
    loadFromServer: () => Promise<void>;
}

export const useArsenal = create<ArsenalState>()((set) => ({
    envelope: DEFAULT_ARSENAL,

    loadFromServer: async () => {
        try {
            const arsenal = asEnvelope(await fetchArsenal());
            if (arsenal) set({ envelope: arsenal });
        } catch {
            /* The local default stands; the Arsenal panel still renders. */
        }
    },
}));

export const selectArsenalModel = (s: ArsenalState): string =>
    typeof s.envelope.data.model === "string" ? s.envelope.data.model : "robot";

export const selectArsenalInventory = (s: ArsenalState): unknown[] =>
    Array.isArray(s.envelope.data.inventory) ? s.envelope.data.inventory : [];

export const loadArsenalFromServer = (): Promise<void> =>
    useArsenal.getState().loadFromServer();

/** The owned item ids: structured entries joined by id, legacy plain-string
 *  entries carried as themselves - neither crashes the join. */
export const selectOwnedItemIds = (s: ArsenalState): string[] =>
    inventoryEntryIds(selectArsenalInventory(s));

/** The equipped cosmetic id, when the player has one. */
export const selectEquippedCosmetic = (s: ArsenalState): string | null => {
    const loadout = s.envelope.data.loadout;
    if (typeof loadout !== "object" || loadout === null) return null;
    const cosmetic = (loadout as Record<string, unknown>).cosmetic;
    return typeof cosmetic === "string" ? cosmetic : null;
};
