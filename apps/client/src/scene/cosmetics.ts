/* The one cosmetic application routine (COS-001, ADR-0008).
 *
 * Every surface that renders the player model applies an owned item's skin
 * through here: a material change on the catalog spec's mesh region of the
 * CharacterLibrary rig. Specs name brand tokens, never raw colours, so the
 * palette stays the brand's and a restyle is live.
 *
 * The routine also stamps `data-equipped-skin` onto the host element it is
 * given, which is what makes the applied material observable by the test
 * surface - the attribute is written by the application itself, not by
 * parallel UI state.
 */

import * as THREE from "three";

import type { CharacterInstance } from "@/scene/CharacterLibrary";
import { BRAND, hslToHex } from "@/brand/tokens";
import type { SkinSpec } from "@/net/shopApi";

/** Brand token name -> hex. The closed vocabulary a catalog spec may use;
 *  anything outside it has no colour to resolve to. */
const SKIN_TOKENS: Record<string, string> = {
    background: hslToHex(BRAND.bg),
    foreground: hslToHex(BRAND.fg),
    muted: hslToHex(BRAND.muted),
    "muted-foreground": hslToHex(BRAND.mutedFg),
    primary: hslToHex(BRAND.primary),
    secondary: hslToHex("30 12% 92%"),
    accent: hslToHex(BRAND.accent),
    destructive: hslToHex(BRAND.destructive),
    border: hslToHex(BRAND.border),
    ring: hslToHex(BRAND.ring),
    "team-2": hslToHex(BRAND.team2),
};

export function resolveTokenColor(token: string): string | null {
    return SKIN_TOKENS[token] ?? null;
}

export interface CosmeticApplication {
    instance: CharacterInstance;
    /** The applied item id; stamped on the host as `data-equipped-skin`. */
    itemId: string;
    skin: SkinSpec;
    host?: HTMLElement | null;
}

export function applyCosmetic(application: CosmeticApplication): void {
    const { instance, itemId, skin, host } = application;
    const region = skin.region ?? "Main";

    if (skin.finish === "gradient" && skin.tokens && skin.tokens.length >= 2) {
        paintGradient(instance, region, skin.tokens);
    } else if (skin.token) {
        const color = resolveTokenColor(skin.token);
        if (color) paintSolid(instance, region, color, skin);
    }

    if (host) host.setAttribute("data-equipped-skin", itemId);
}

function eachRegionMaterial(
    instance: CharacterInstance,
    region: string,
    visit: (material: THREE.MeshStandardMaterial) => void,
): void {
    instance.root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.name !== region) return;
        visit(material);
    });
}

function paintSolid(
    instance: CharacterInstance,
    region: string,
    hex: string,
    skin: SkinSpec,
): void {
    const color = new THREE.Color(hex);
    eachRegionMaterial(instance, region, (material) => {
        material.color.copy(color);
        material.metalness = skin.metalness ?? material.metalness;
        material.roughness = skin.roughness ?? material.roughness;
        material.needsUpdate = true;
    });
}

/** A gradient across the rig: each region mesh takes the two token colours
 *  lerped by its own height in the model's bounds, so the blend runs
 *  bottom-to-top over the body panels that carry the region material. */
function paintGradient(
    instance: CharacterInstance,
    region: string,
    tokens: string[],
): void {
    const from = resolveTokenColor(tokens[0]);
    const to = resolveTokenColor(tokens[tokens.length - 1]);
    if (!from || !to) return;

    const bounds = new THREE.Box3().setFromObject(instance.root);
    const range = Math.max(bounds.max.y - bounds.min.y, 0.001);

    instance.root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.name !== region) return;
        mesh.geometry.computeBoundingBox();
        const meshBounds = mesh.geometry.boundingBox;
        if (!meshBounds) return;
        // The mesh's centre height, normalized over the whole rig.
        const center = new THREE.Vector3();
        meshBounds.getCenter(center);
        center.applyMatrix4(mesh.matrixWorld);
        const t = THREE.MathUtils.clamp(
            (center.y - bounds.min.y) / range,
            0,
            1,
        );
        material.color.set(from).lerp(new THREE.Color(to), t);
        material.needsUpdate = true;
    });
}
