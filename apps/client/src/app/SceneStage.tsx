import { useEffect, useRef } from "react";

import { getGameRuntime } from "./GameRuntime";

/* The one boundary between React and Three.js.
 *
 * React owns this element and nothing inside it. The renderer's canvas is
 * appended by the scene module, so no Three.js object is ever reachable
 * from a prop, a piece of state or a context.
 *
 * The element carries `id="app"` and `data-scene-ready`, which the scene
 * flips on its first drawn frame: it is the signal that the game is on
 * screen rather than merely loaded.
 */
export const SceneStage = () => {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const runtime = getGameRuntime();
        runtime.attachScene(host);
        return () => runtime.detachScene();
    }, []);

    return <div id="app" data-scene-ready="false" ref={hostRef} />;
};
