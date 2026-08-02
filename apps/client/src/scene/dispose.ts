/* Releasing GPU memory.
 *
 * Three.js holds buffers outside the JavaScript heap, so dropping the
 * last reference to a mesh frees nothing: the geometry and the material
 * stay resident until something disposes them by hand. A match that
 * rebuilds an arena or cycles through players leaks a little each time
 * otherwise, which is why every owner in this directory routes its
 * teardown through here.
 *
 * Textures are deliberately not swept up by these helpers. A texture is
 * routinely shared between materials that do not know about each other,
 * so disposing one from under a mesh that still draws it is a black
 * square on screen. Whoever created a texture disposes it.
 */

import * as THREE from "three";

/** Dispose everything under `root`, the root included. */
export function disposeObject(root: THREE.Object3D): void {
    root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) for (const one of material) one.dispose();
        else material?.dispose();
    });
}

/** Empty a group, disposing what came out of it. */
export function disposeChildren(group: THREE.Object3D): void {
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
    }
}
