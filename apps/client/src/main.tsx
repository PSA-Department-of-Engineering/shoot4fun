/* Shoot4Fun entry point.
 *
 * Three jobs, in order: wire what the runtime produces into the
 * viewmodels that hold it, mount the React shell, and adopt whatever the
 * browser already knows (the stored name, the room in the URL, the saved
 * preferences).
 *
 * The wiring is the only place the two halves of the client meet. The
 * runtime knows nothing about viewmodels and the viewmodels reach the
 * runtime only through its commands, so the arrows point one way and the
 * import graph has no cycle.
 *
 * There is no `StrictMode` wrapper: its deliberate double-mount exists to
 * surface effects that are not idempotent, and the effects here mount a
 * WebGL context and a socket, which are single by nature and guarded as
 * such in `GameRuntime`.
 */

import { createRoot } from "react-dom/client";

import App from "./app/App";
import { getGameRuntime } from "./app/GameRuntime";
import { useAccount } from "./ui/viewmodels/account";
import { useRoom } from "./ui/viewmodels/room";
import { useSession } from "./ui/viewmodels/session";
import { useSettings } from "./ui/viewmodels/settings";
import "./brand/theme.css";

const LATENCY_POLL_MS = 2000;

const container = document.getElementById("root");
if (!container) throw new Error("missing #root container");

const runtime = getGameRuntime();

runtime.onSnapshot((room) => useRoom.getState().adoptSnapshot(room));
runtime.onLocalPlayer((player) => useRoom.getState().setLocalPlayerId(player.id));
runtime.onLockedChange((locked) => useRoom.getState().setPointerLocked(locked));
runtime.onStatus((status) => useSession.getState().noteStatus(status));
runtime.onServerError((error) => useSession.getState().noteServerError(error));

/* Latency is answered by a pong, so it is read on a clock rather than
 * pushed: the socket has no event for "the number you are showing is
 * now stale". */
window.setInterval(
    () => useSession.getState().noteLatency(runtime.latency()),
    LATENCY_POLL_MS,
);

/* The room lives in the URL fragment, so the browser's back and forward
 * buttons are room navigation. */
window.addEventListener("hashchange", () => useSession.getState().followUrl());

createRoot(container).render(<App />);

useSettings.getState().hydrate();
useSession.getState().hydrate();

/* The account resolves after the local preferences, and never blocks the
 * render above: a guest is minted server-side on first entry, and a server
 * that cannot be reached leaves the game entirely playable. Once an account
 * is known, a registered player's stored preferences replace the local ones. */
void useAccount
    .getState()
    .hydrate()
    .then(() => {
        if (useAccount.getState().registered) void useSettings.getState().pullFromAccount();
    });
