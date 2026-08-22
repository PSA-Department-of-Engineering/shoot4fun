/* Pure helpers over the Arsenal envelope's inventory collection (ADR-0008).
 *
 * Ownership IS presence in `data.inventory`: structured entries carry the
 * item id in `id`, and legacy plain-string entries (none exist today) name
 * an item by their own value. Neither shape may crash the join with
 * catalog metadata.
 */

import type { ArsenalEnvelope } from "./arsenal.state";

/** Every id the inventory names, structured entries and legacy strings
 *  alike; anything else is skipped rather than thrown on. */
export function inventoryEntryIds(inventory: unknown[]): string[] {
    const ids: string[] = [];
    for (const entry of inventory) {
        if (typeof entry === "string") {
            ids.push(entry);
        } else if (
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).id === "string"
        ) {
            ids.push((entry as { id: string }).id);
        }
    }
    return ids;
}

export function ownedItemIds(envelope: ArsenalEnvelope): string[] {
    const inventory = Array.isArray(envelope.data.inventory)
        ? envelope.data.inventory
        : [];
    return inventoryEntryIds(inventory);
}

/** The equipped cosmetic id from `data.loadout.cosmetic` - inside `data`,
 *  never beside it (ADR-0008). */
export function equippedCosmeticOf(
    envelope: ArsenalEnvelope,
): string | null {
    const loadout = envelope.data.loadout;
    if (typeof loadout !== "object" || loadout === null) return null;
    const cosmetic = (loadout as Record<string, unknown>).cosmetic;
    return typeof cosmetic === "string" ? cosmetic : null;
}
