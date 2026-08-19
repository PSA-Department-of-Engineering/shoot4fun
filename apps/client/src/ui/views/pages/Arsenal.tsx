/* The Arsenal view (ARS-001/002/003, issue #41).

Two panels: the player model and the inventory/loadout. The model panel
renders the rig `CharacterLibrary` already loads for the match, with a
placeholder note that the full 3D character *viewer* is a later line (design.md
out-of-scope). The loadout panel renders gracefully empty, bound to the
forward-compatible Arsenal envelope (ARS-004 / ADR-0007), so the deferred
shop and weapon-unlock work drop into a structure already present.

The view reads the locked brand tokens via `theme.css` (docs/brand.md): the
card, the one-pixel primary->accent top stripe, the muted-foreground empty
copy. No new hue, font, or shape.
*/
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useArsenal } from "@/ui/viewmodels/arsenal/arsenal.store";
import { useAccount } from "@/ui/viewmodels/account";

import { Button } from "../atoms/Button";
import { MenuTemplate } from "../templates/MenuTemplate";
import { CharacterLibrary } from "@/scene/CharacterLibrary";

const PLAYER_HEIGHT = 1.7;
const TEAM_COLOR = new THREE.Color("#F94B1F");

/* The rig, living in its own WebGL context. A standalone renderer/camera/loop
 * that is torn down on unmount; the shared match scene is unaffected. If the
 * asset or WebGL is unavailable the panel still shows its placeholder note,
 * so the view degrades to a labelled empty slot rather than a blank box. */
function ArsenalCharacter({ model }: { model: string | null }) {
    const host = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = host.current;
        if (!container) return;
        let disposed = false;
        let frame = 0;
        let renderer: THREE.WebGLRenderer | null = null;
        let instance: ReturnType<CharacterLibrary["create"]> | null = null;
        let mixer: THREE.AnimationMixer | null = null;
        const clock = new THREE.Clock();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
        camera.position.set(0, PLAYER_HEIGHT * 0.9, 3.2);
        camera.lookAt(0, PLAYER_HEIGHT * 0.85, 0);
        scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(2, 4, 3);
        scene.add(key);

        const library = new CharacterLibrary(PLAYER_HEIGHT);
        void library.ready().then((lib) => {
            if (disposed || !lib) return;
            instance = lib.create(TEAM_COLOR);
            if (!instance) return;
            scene.add(instance.root);
            mixer = instance.mixer;
            try {
                instance.action("idle").play();
            } catch {
                /* rig without an idle clip: standing silhouette is enough */
            }
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            const resize = () => {
                const size = container.clientWidth || 240;
                renderer!.setSize(size, size, false);
                camera.aspect = 1;
                camera.updateProjectionMatrix();
            };
            resize();
            container.appendChild(renderer.domElement);
            const loop = () => {
                if (disposed) return;
                frame = requestAnimationFrame(loop);
                const dt = clock.getDelta();
                mixer?.update(dt);
                renderer?.render(scene, camera);
            };
            loop();
        });

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            mixer?.stopAllAction();
            instance?.dispose();
            if (renderer) {
                renderer.dispose();
                renderer.domElement.remove();
            }
        };
    }, [model]);

    return (
        <div className="arsenal__model" data-arsenal-model>
            <div className="arsenal__model-canvas" ref={host} aria-hidden="true" />
            <p className="arsenal__model-note" data-arsenal-model-placeholder>
                {model ? `Model: ${model}` : "3D character viewer coming soon"}
            </p>
        </div>
    );
}

const Arsenal = () => {
    const onBack = () => window.history.length > 1 && window.history.back();
    const registered = useAccount((s) => s.registered);
    const pullFromAccount = useArsenal((s) => s.pullFromAccount);
    const model = useArsenal((s) => s.model);
    const loadout = useArsenal((s) => s.loadout);
    const loaded = useArsenal((s) => s.loaded);

    useEffect(() => {
        if (registered) void pullFromAccount();
    }, [registered, pullFromAccount]);

    const entries = Object.entries(loadout);

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <h1 className="menu__title">Arsenal</h1>
                    <p className="menu__lead">
                        Your loadout and weapon unlocks (#41).
                    </p>
                </>
            }
            footer={
                <Button variant="ghost" onClick={onBack} data-menu-back>
                    &larr; Back to menu
                </Button>
            }
        >
            <div className="arsenal">
                <section className="arsenal__panel" aria-label="Player model">
                    <h2 className="arsenal__panel-title">Character</h2>
                    <ArsenalCharacter model={model} />
                </section>

                <section
                    className="arsenal__panel"
                    aria-label="Inventory and loadout"
                    data-arsenal-inventory
                >
                    <h2 className="arsenal__panel-title">Loadout</h2>
                    {entries.length === 0 ? (
                        <div className="arsenal__empty" data-arsenal-empty>
                            <p className="arsenal__empty-copy">
                                Your loadout is empty.
                            </p>
                            <Button variant="secondary" disabled data-arsenal-shop>
                                Browse shop
                            </Button>
                            <p className="arsenal__empty-note">
                                {loaded
                                    ? "Nothing equipped yet."
                                    : "Sign in to load your saved loadout."}
                            </p>
                        </div>
                    ) : (
                        <ul className="arsenal__loadout">
                            {entries.map(([slot, item]) => (
                                <li className="arsenal__item" key={slot} data-arsenal-item>
                                    <span className="arsenal__item-slot">{slot}</span>
                                    <span className="arsenal__item-name">
                                        {typeof item === "string" ? item : JSON.stringify(item)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </MenuTemplate>
    );
};

export default Arsenal;
