import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneApp {
    mount(container: HTMLElement): void;
    start(): void;
    stop(): void;
    dispose(): void;
}

export function createSceneApp(): SceneApp {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);

    // The camera rides a rig; locomotion (and XR presentation) moves the rig,
    // never the camera itself (REF-ThreeJS section 9). Units are meters, Y up.
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 1.6, 3);
    const rig = new THREE.Group();
    rig.name = 'camera-rig';
    rig.add(camera);
    scene.add(rig);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(3, 5, 2);
    scene.add(sun);

    // Demo content: replace with the real scene, keep the group + naming shape.
    const content = new THREE.Group();
    content.name = 'demo-content';
    const knot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.4, 0.14, 128, 32),
        new THREE.MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.3, metalness: 0.1 }),
    );
    knot.name = 'demo-knot';
    knot.position.set(0, 1.2, 0);
    content.add(knot);
    const floor = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 0.05, 48),
        new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.9 }),
    );
    floor.name = 'demo-floor';
    floor.position.y = -0.025;
    content.add(floor);
    scene.add(content);

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let host: HTMLElement | null = null;
    const clock = new THREE.Clock();

    function frame(): void {
        const dt = clock.getDelta();
        knot.rotation.x += dt * 0.6;
        knot.rotation.y += dt * 0.9;
        controls?.update();
        if (renderer) renderer.render(scene, camera);
        // Readiness signal: flips once the first frame has actually rendered.
        // The smoke e2e (and any loading UI) keys off it.
        if (host && host.dataset.sceneReady !== 'true') host.dataset.sceneReady = 'true';
    }

    return {
        mount(container: HTMLElement): void {
            host = container;
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            container.appendChild(renderer.domElement);
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.target.set(0, 1.2, 0);

            observer = new ResizeObserver(() => {
                if (!renderer || !host) return;
                const width = host.clientWidth;
                const height = Math.max(host.clientHeight, 1);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
            });
            observer.observe(container);
        },
        start(): void {
            renderer?.setAnimationLoop(frame);
        },
        stop(): void {
            renderer?.setAnimationLoop(null);
        },
        dispose(): void {
            this.stop();
            observer?.disconnect();
            observer = null;
            controls?.dispose();
            controls = null;
            scene.traverse((node) => {
                const mesh = node as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
                const materials = Array.isArray(material) ? material : material ? [material] : [];
                for (const m of materials) m.dispose();
            });
            renderer?.dispose();
            renderer?.domElement.remove();
            renderer = null;
            host = null;
        },
    };
}
