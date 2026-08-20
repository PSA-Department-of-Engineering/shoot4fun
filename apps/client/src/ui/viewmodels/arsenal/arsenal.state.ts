/* The Arsenal data shape, client side (ARS-004, ADR-0007).
 *
 * Local-first: the Arsenal view binds to the same versioned envelope the
 * server stores, so the deferred shop and weapon-unlock work drops into a
 * structure already present. The envelope keeps an opaque `data` object, so
 * fields a future that adds (outfits, stats, unlocks) survive untouched.
 */

import { create } from "zustand";

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

interface ArsenalState {
    envelope: ArsenalEnvelope;
}

export const useArsenal = create<ArsenalState>(() => ({
    envelope: DEFAULT_ARSENAL,
}));

export const selectArsenalModel = (s: ArsenalState): string =>
    typeof s.envelope.data.model === "string" ? s.envelope.data.model : "robot";

export const selectArsenalInventory = (s: ArsenalState): unknown[] =>
    Array.isArray(s.envelope.data.inventory) ? s.envelope.data.inventory : [];
