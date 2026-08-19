/* Arsenal state: the player's model and loadout, read from the account.

The shape is the forward-compatible envelope from ADR-0007. Like the
settings store, a signed-in player's Arsenal is the source of truth on the
server; a guest keeps the empty default locally. This line only reads it
(the shop/unlock editors are a later line), so the store is a read-through
of `GET /api/account/arsenal` gated on registration.
*/
import { create } from "zustand";

import { fetchArsenal } from "@/net/accountApi";
import { useAccount } from "@/ui/viewmodels/account";

interface ArsenalState {
    version: number;
    model: string | null;
    loadout: Record<string, unknown>;
    loaded: boolean;
    /** Adopt the account's stored Arsenal, for a player who just signed in. */
    pullFromAccount: () => Promise<void>;
}

export const useArsenal = create<ArsenalState>()((set) => ({
    version: 1,
    model: null,
    loadout: {},
    loaded: false,

    pullFromAccount: async () => {
        if (!useAccount.getState().registered) return;
        try {
            const arsenal = await fetchArsenal();
            set({
                version: arsenal.version,
                model: arsenal.model,
                loadout: arsenal.loadout,
                loaded: true,
            });
        } catch {
            /* The local default stands; the Arsenal panel still renders. */
        }
    },
}));
