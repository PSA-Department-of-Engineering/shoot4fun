/* Session actions: the only place that reads the URL, touches storage,
 * or asks the runtime to open a socket.
 *
 * The room lives in the URL fragment, so a room is a link: pasting one
 * into a second browser is how a second player arrives, and the browser's
 * own back and forward buttons move between rooms.
 */

import { create } from "zustand";

import { getGameRuntime, type ConnectionStatus, type ServerError } from "@/app/GameRuntime";
import { useAccount } from "@/ui/viewmodels/account";

import {
    isNameValid,
    isRoomCodeValid,
    ROOM_CODE_ACCEPTED,
    ROOM_CODE_ALPHABET,
} from "./session.model";
import {
    NAME_MAX_LENGTH,
    ROOM_CODE_LENGTH,
    type SessionState,
} from "./session.state";

const PLAYER_NAME_KEY = "sf_player_name";
const INVITE_COPIED_MS = 1600;

interface SessionActions {
    /** Adopt the stored name and the room in the URL, joining if both are known. */
    hydrate: () => void;
    setPlayerName: (name: string) => void;
    setRoomCode: (code: string) => void;
    /** Mint a fresh room code and join it. */
    createRoom: () => Promise<void>;
    /** Join the room currently in the form. */
    joinRoom: () => Promise<void>;
    /** Follow a room change that came from the URL rather than the form. */
    followUrl: () => void;
    copyInvite: () => Promise<void>;
    /** Enter the solo aim-training range (issue #15). No room, no socket:
     * the range runs entirely on the client. */
    enterSolo: () => void;
    /** Leave the range and return to the entry screen. */
    exitSolo: () => void;
    /** Enter as a guest: both this and `chooseLogin` land on the same
     * main menu (issue #42). Login's own account/profile flow is #41. */
    chooseGuest: () => void;
    /** Enter via login: open the sign-in dialog rather than dropping the
     * player onto the menu untyped. Both guests and signed-in players land
     * on the same main menu afterwards (issue #42). */
    chooseLogin: () => void;
    /** Open the Arsenal view from the main menu (issue #41). */
    enterArsenal: () => void;
    /** Leave the Arsenal view and return to the main menu. */
    exitArsenal: () => void;
    /** Open the shop catalog (from the main-menu tile or the Arsenal's
     *  Browse shop affordance). */
    enterShop: () => void;
    /** Open an item's detail screen from the catalog. The item itself rides
     *  the shop store's `selectItem`, called before this flips the screen. */
    openShopItem: () => void;
    /** The locked back path: detail -> catalog. */
    backToShopCatalog: () => void;
    /** The locked back path: catalog -> arsenal. */
    exitShopToArsenal: () => void;
    /** Show the Acquired & Apply screen after a successful unlock. */
    gotoShopAcquired: () => void;
    noteStatus: (status: ConnectionStatus) => void;
    noteLatency: (latencyMs: number) => void;
    noteServerError: (error: ServerError) => void;
}

const SERVER_ERROR_MESSAGES: Record<string, string> = {
    ROOM_FULL: "That room is full. Try another code.",
    BAD_HELLO: "The server refused the connection.",
    BAD_JSON: "The server could not read a message.",
};

/** Uppercase, drop punctuation and spacing, and bound the length. */
function sanitizeRoomCode(raw: string): string {
    return raw.toUpperCase().replace(ROOM_CODE_ACCEPTED, "").slice(0, ROOM_CODE_LENGTH);
}

function generateRoomCode(): string {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[index];
    }
    return code;
}

function readRoomCodeFromUrl(): string {
    return sanitizeRoomCode(window.location.hash.replace(/^#\/?/, "").trim());
}

function writeRoomCodeToUrl(code: string): void {
    const next = `#/${code}`;
    if (window.location.hash !== next) window.location.hash = next;
}

function readStoredName(): string {
    return (window.localStorage.getItem(PLAYER_NAME_KEY) ?? "").slice(0, NAME_MAX_LENGTH);
}

export const useSession = create<SessionState & SessionActions>()((set, get) => ({
    playerName: "",
    roomCode: "",
    phase: "entry",
    connection: "idle",
    latencyMs: 0,
    error: null,
    inviteCopied: false,
    solo: false,
    screen: "launch",

    hydrate: () => {
        const playerName = readStoredName();
        const roomCode = readRoomCodeFromUrl();
        set({ playerName, roomCode });
        // A player who has been here before and followed a room link has
        // already answered both questions the entry screen asks.
        if (isNameValid(playerName) && isRoomCodeValid(roomCode)) {
            void get().joinRoom();
        }
    },

    setPlayerName: (name) =>
        set({ playerName: name.slice(0, NAME_MAX_LENGTH), error: null }),

    setRoomCode: (code) => set({ roomCode: sanitizeRoomCode(code), error: null }),

    createRoom: async () => {
        set({ roomCode: generateRoomCode() });
        await get().joinRoom();
    },

    joinRoom: async () => {
        const { playerName, roomCode } = get();
        if (!isNameValid(playerName) || !isRoomCodeValid(roomCode)) return;
        const name = playerName.trim();
        window.localStorage.setItem(PLAYER_NAME_KEY, name);
        writeRoomCodeToUrl(roomCode);
        set({ phase: "joining", error: null, connection: "connecting" });
        try {
            await getGameRuntime().join(name, roomCode);
            set({ phase: "joined" });
        } catch (error) {
            set({
                phase: "entry",
                connection: "closed",
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not reach the match server.",
            });
        }
    },

    followUrl: () => {
        const roomCode = readRoomCodeFromUrl();
        if (roomCode === get().roomCode) return;
        set({ roomCode });
        if (isRoomCodeValid(roomCode) && isNameValid(get().playerName)) {
            void get().joinRoom();
        }
    },

    copyInvite: async () => {
        const url = `${window.location.origin}${window.location.pathname}#/${get().roomCode}`;
        try {
            await navigator.clipboard.writeText(url);
            set({ inviteCopied: true });
            window.setTimeout(() => set({ inviteCopied: false }), INVITE_COPIED_MS);
        } catch {
            // Clipboard access is a permission, and the code is on screen
            // to be read out either way.
            set({ inviteCopied: false });
        }
    },

    enterSolo: () => {
        getGameRuntime().enterTraining();
        set({ solo: true });
    },

    exitSolo: () => {
        getGameRuntime().exitTraining();
        set({ solo: false });
    },

    chooseGuest: () => set({ screen: "menu" }),

    chooseLogin: () => useAccount.getState().openDialog("signIn"),

    enterArsenal: () => set({ screen: "arsenal" }),

    exitArsenal: () => set({ screen: "menu" }),

    enterShop: () => set({ screen: "shop-catalog" }),

    openShopItem: () => set({ screen: "shop-item" }),

    backToShopCatalog: () => set({ screen: "shop-catalog" }),

    exitShopToArsenal: () => set({ screen: "arsenal" }),

    gotoShopAcquired: () => set({ screen: "shop-acquired" }),

    /* A dropped socket leaves the player where they were, told the truth
     * about it, rather than throwing them back to the entry screen. */
    noteStatus: (status) => set({ connection: status }),

    noteLatency: (latencyMs) => set({ latencyMs }),

    noteServerError: (error) =>
        set({
            phase: "entry",
            error: SERVER_ERROR_MESSAGES[error.code] ?? error.detail ?? error.code,
        }),
}));
