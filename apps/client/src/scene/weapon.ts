/* The weapon, built once and seen from two places.
 *
 * The holder sees it in their own view and everyone else sees it on the
 * body that carries it, and those two must be the same object or the
 * game lies about what it is shooting with. So the shape lives here and
 * both views build it from this function.
 *
 * It is modelled along -Z, the direction a player faces at yaw zero,
 * with the muzzle at the end of the barrel: whatever parents the rig
 * decides where the shot appears to come from, and it is always the
 * same point on the gun.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";

export interface WeaponRig {
    root: THREE.Group;
    /** The barrel tip. A shot's tracer and flash start here. */
    muzzle: THREE.Object3D;
    dispose(): void;
}

/** Build a rifle. `accent` marks it as the carrier's, so a team colour
 * or the brand's own reads at a glance. */
export function buildWeapon(accent: THREE.ColorRepresentation): WeaponRig {
    const root = new THREE.Group();
    root.name = "weapon";

    const frame = new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.arenaCover,
        roughness: 0.45,
        metalness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.fg,
        roughness: 0.7,
        metalness: 0.15,
    });
    const mark = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.2,
    });
    const materials = [frame, dark, mark];
    const geometries: THREE.BufferGeometry[] = [];

    function part(
        material: THREE.Material,
        size: [number, number, number],
        at: [number, number, number],
    ): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(at[0], at[1], at[2]);
        mesh.castShadow = true;
        root.add(mesh);
        return mesh;
    }

    part(frame, [0.085, 0.11, 0.34], [0, 0, -0.04]);
    part(dark, [0.045, 0.045, 0.42], [0, 0.02, -0.4]);
    part(dark, [0.055, 0.17, 0.09], [0, -0.12, 0.02]);
    part(dark, [0.055, 0.12, 0.07], [0, -0.09, 0.13]);
    part(frame, [0.065, 0.095, 0.2], [0, 0.0, 0.22]);
    // A rail, not a block: the accent marks the weapon as the
    // carrier's, and anything bigger owns the middle of the screen.
    part(mark, [0.022, 0.022, 0.24], [0, 0.075, -0.12]);

    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle";
    muzzle.position.set(0, 0.02, -0.62);
    root.add(muzzle);

    return {
        root,
        muzzle,
        dispose() {
            for (const geometry of geometries) geometry.dispose();
            for (const material of materials) material.dispose();
            root.removeFromParent();
        },
    };
}
