import { useEffect, useRef } from "react";
import * as THREE from "three";

import { CharacterLibrary, type CharacterInstance } from "@/scene/CharacterLibrary";
import { SCENE_COLORS } from "@/brand/tokens";
import { applyCosmetic, type CosmeticApplication } from "@/scene/cosmetics";
import type { SkinSpec } from "@/net/shopApi";

const PLAYER_HEIGHT = 1.8;

export interface RigViewProps {
    /** The owned cosmetic to apply, if any. The application goes through
     *  the one shared routine (COS-001), which stamps `data-equipped-skin`
     *  onto this panel's host element. */
    cosmeticId?: string | null;
    cosmeticSkin?: SkinSpec | null;
}

/* The operator's rig in the Arsenal model panel (INT-027 / ARS-002).
 *
 * Renders the same CharacterLibrary model the match avatars stand up, on a
 * small lit stage, so the player sees the avatar the account owns - with
 * any equipped cosmetic's material skin applied through the shared
 * routine. The full 3D viewer (rotate, pick a loadout) is deferred; until
 * it lands this panel is its placeholder, and when the model cannot be
 * fetched it degrades to a silent placeholder rather than a broken panel.
 */
export const RigView = ({ cosmeticId, cosmeticSkin }: RigViewProps = {}) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const instanceRef = useRef<CharacterInstance | null>(null);

    // Keep the latest cosmetic where the mount effect can read it without
    // rebuilding the renderer on every change.
    const cosmeticRef = useRef<CosmeticApplication["skin"] | null>(
        cosmeticSkin ?? null,
    );
    const cosmeticIdRef = useRef<string | null>(cosmeticId ?? null);
    cosmeticRef.current = cosmeticSkin ?? null;
    cosmeticIdRef.current = cosmeticId ?? null;

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
        camera.position.set(0, 1.05, 3.2);
        camera.lookAt(0, 1.0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x000000, 0);

        const fill = new THREE.HemisphereLight(0xffffff, 0x444444, 1.6);
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(2, 4, 3);
        scene.add(fill, key);

        const root = new THREE.Group();
        root.position.y = PLAYER_HEIGHT / 2;
        scene.add(root);

        const library = new CharacterLibrary(PLAYER_HEIGHT);
        const resize = () => {
            const width = Math.max(host.clientWidth, 1);
            const height = Math.max(host.clientHeight, 1);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        host.appendChild(renderer.domElement);
        resize();

        let cancelled = false;
        let instance: CharacterInstance | null = null;
        const clock = new THREE.Clock();

        void library.ready().then((ready) => {
            if (!ready || cancelled) return;
            instance = ready.create(new THREE.Color(SCENE_COLORS.team1));
            if (!instance) return;
            instanceRef.current = instance;
            root.add(instance.root);
            instance
                .action("idle")
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .play();
            // An equipped cosmetic applies as soon as there is a rig to
            // apply it to; the routine writes the observable attribute.
            const id = cosmeticIdRef.current;
            const spec = cosmeticRef.current;
            if (id && spec) {
                applyCosmetic({ instance, itemId: id, skin: spec, host });
            }
        });

        renderer.setAnimationLoop(() => {
            if (instance) instance.mixer.update(clock.getDelta());
            renderer.render(scene, camera);
        });

        return () => {
            cancelled = true;
            instanceRef.current = null;
            renderer.setAnimationLoop(null);
            observer.disconnect();
            instance?.dispose();
            library.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === host) {
                host.removeChild(renderer.domElement);
            }
        };
    }, []);

    // A cosmetic change while mounted re-runs the same shared routine.
    useEffect(() => {
        const host = hostRef.current;
        const instance = instanceRef.current;
        if (!host || !instance || !cosmeticId || !cosmeticSkin) return;
        applyCosmetic({
            instance,
            itemId: cosmeticId,
            skin: cosmeticSkin,
            host,
        });
    }, [cosmeticId, cosmeticSkin]);

    return (
        <div
            className="arsenal__rig"
            ref={hostRef}
            data-arsenal-rig
            data-equipped-surface
        />
    );
};
