import { useEffect, useRef } from "react";

import { getGameRuntime } from "./GameRuntime";

/* The boundary around the imperative HUD.
 *
 * Health, ammo and the score change as fast as the server sends them, and
 * a component tree is the wrong instrument for nine text nodes at that
 * rate. React supplies the element; the HUD module writes into it, and
 * the state it draws never enters a store.
 *
 * It stays mounted between matches so its elements are always in the
 * document, and dims itself when no match is running.
 */
export const HudLayer = () => {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const runtime = getGameRuntime();
        runtime.attachHud(host);
        return () => runtime.detachHud();
    }, []);

    return <div className="hud-host" ref={hostRef} />;
};
