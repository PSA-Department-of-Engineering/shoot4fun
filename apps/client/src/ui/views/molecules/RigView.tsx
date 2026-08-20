import { useEffect, useRef } from "react";
import * as THREE from "three";

import { CharacterLibrary, type CharacterInstance } from "@/scene/CharacterLibrary";
import { SCENE_COLORS } from "@/brand/tokens";

const PLAYER_HEIGHT = 1.8;

/* The operator's rig in the Arsenal model panel (INT-027 / ARS-002).
 *
 * Renders the same CharacterLibrary model the match avatars stand up, on a
 * small lit stage, so the player sees the avatar the account owns. The full
 * 3D viewer (rotate, pick a loadout) is deferred; until it lands this panel
 * is its placeholder, and when the model cannot be fetched it degrades to a
 * silent placeholder rather than a broken panel.
 */
export const RigView = () => {
    const hostRef = useRef<HTMLDivElement | null>(null);

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
            root.add(instance.root);
            instance
                .action("idle")
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .play();
        });

        renderer.setAnimationLoop(() => {
            if (instance) instance.mixer.update(clock.getDelta());
            renderer.render(scene, camera);
        });

        return () => {
            cancelled = true;
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

    return <div className="arsenal__rig" ref={hostRef} data-arsenal-rig />;
};