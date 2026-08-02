/* Room actions. Every one of them is a request to the server, never a
 * local edit of the room: the client sends intent and the server answers
 * with the snapshot everyone in the room sees (ADR-0003).
 */

import { create } from "zustand";

import { getGameRuntime } from "@/app/GameRuntime";
import type { RoomSnapshot } from "@/net/protocol";

import { roomSignature, selectIsReady } from "./room.model";
import type { ArenaOption, RoomState } from "./room.state";

interface RoomActions {
    adoptSnapshot: (snapshot: RoomSnapshot) => void;
    setLocalPlayerId: (id: string) => void;
    setPointerLocked: (locked: boolean) => void;
    toggleReady: () => void;
    /** Read the arenas the server offers. Answering once is enough: the
     * catalogue is fixed for the life of the server. */
    loadArenas: () => Promise<void>;
    selectArena: (arenaId: string) => void;
    startMatch: () => void;
    rematch: () => void;
    /** Take the mouse. Must be called from inside a user gesture; the
     * browser refuses otherwise, and answers false. */
    capturePointer: () => Promise<boolean>;
}

export const useRoom = create<RoomState & RoomActions>()((set, get) => ({
    snapshot: null,
    localPlayerId: "",
    pointerLocked: false,
    arenas: [],

    adoptSnapshot: (snapshot) => {
        const current = get().snapshot;
        /* A running match publishes nothing to the menus: the HUD reads
         * the live snapshot straight off the runtime, and the shell has
         * only the pointer-lock gate on screen. */
        if (snapshot.state === "playing" && current?.state === "playing") return;
        if (current && roomSignature(current) === roomSignature(snapshot)) return;
        set({ snapshot });
    },

    setLocalPlayerId: (localPlayerId) => set({ localPlayerId }),

    setPointerLocked: (pointerLocked) => set({ pointerLocked }),

    toggleReady: () => getGameRuntime().setReady(!selectIsReady(get())),

    loadArenas: async () => {
        if (get().arenas.length > 0) return;
        try {
            const response = await fetch("/api/arenas");
            if (!response.ok) return;
            set({ arenas: (await response.json()) as ArenaOption[] });
        } catch {
            /* No catalogue, so no picker. The room still plays: it opens
             * on the arena the server chose, and only the choice is
             * missing. */
        }
    },

    selectArena: (arenaId) => getGameRuntime().selectMap(arenaId),

    startMatch: () => getGameRuntime().startMatch(),

    rematch: () => getGameRuntime().rematch(),

    capturePointer: async () => {
        const locked = await getGameRuntime().requestLock();
        set({ pointerLocked: locked });
        return locked;
    },
}));
