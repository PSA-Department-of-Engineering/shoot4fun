/* Textures the scene draws with, drawn at runtime on a 2D canvas.
 *
 * Two kinds live here and the difference matters. A *surface* texture
 * carries brand colour and is filled from `SCENE_COLORS`. A *mask* is
 * greyscale with an alpha ramp and carries no colour at all: the
 * material that draws it supplies the token colour, so a mask can be
 * reused by a muzzle flash and an impact spark without either of them
 * inlining a value the brand does not own.
 *
 * Every texture here is disposable and every owner disposes it.
 */

import * as THREE from "three";

import { SCENE_COLORS } from "../brand/tokens";

function surface(size: number): CanvasRenderingContext2D {
    const element = document.createElement("canvas");
    element.width = size;
    element.height = size;
    const context = element.getContext("2d");
    if (!context) throw new Error("2d canvas context unavailable");
    return context;
}

function finish(
    context: CanvasRenderingContext2D,
    colorSpace: THREE.ColorSpace,
): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(context.canvas);
    texture.colorSpace = colorSpace;
    return texture;
}

/* The arena floor.
 *
 * Speed is invisible over a flat colour: with nothing passing under the
 * feet, a player walking at six metres a second reads as standing
 * still. The grid is what turns locomotion into motion. */
export function createGroundTexture(): THREE.CanvasTexture {
    const size = 256;
    const context = surface(size);
    context.fillStyle = SCENE_COLORS.arenaGround;
    context.fillRect(0, 0, size, size);

    context.strokeStyle = SCENE_COLORS.arenaCover;
    context.globalAlpha = 0.28;
    context.lineWidth = 3;
    context.strokeRect(0, 0, size, size);

    context.globalAlpha = 0.12;
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 1; i < 4; i++) {
        const at = (size / 4) * i;
        context.moveTo(at, 0);
        context.lineTo(at, size);
        context.moveTo(0, at);
        context.lineTo(size, at);
    }
    context.stroke();
    context.globalAlpha = 1;

    const texture = finish(context, THREE.SRGBColorSpace);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    /* The floor is the one surface seen edge on, all the way to the far
     * wall, so it is the one that needs anisotropic filtering. The masks
     * are always square to the viewer and would pay for nothing. */
    texture.anisotropy = 4;
    return texture;
}

/** A soft round mask, opaque at the centre and clear at the rim. */
export function createGlowMask(): THREE.CanvasTexture {
    const size = 128;
    const context = surface(size);
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.75)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return finish(context, THREE.SRGBColorSpace);
}

/** A bullet hole: a solid core inside a scorched, ragged rim. */
export function createImpactMask(): THREE.CanvasTexture {
    const size = 64;
    const context = surface(size);
    const half = size / 2;

    const scorch = context.createRadialGradient(half, half, 0, half, half, half);
    scorch.addColorStop(0, "rgba(255,255,255,0.95)");
    scorch.addColorStop(0.45, "rgba(255,255,255,0.45)");
    scorch.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = scorch;
    context.fillRect(0, 0, size, size);

    // A perfect circle reads as a decal; the notched rim reads as damage.
    context.fillStyle = "rgba(255,255,255,1)";
    context.beginPath();
    const points = 11;
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const radius = half * (0.2 + 0.06 * Math.sin(i * 2.7));
        const x = half + Math.cos(angle) * radius;
        const y = half + Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();

    return finish(context, THREE.SRGBColorSpace);
}

/** Clear through the middle, solid at the edges: the frame of the view. */
export function createVignetteMask(): THREE.CanvasTexture {
    const size = 128;
    const context = surface(size);
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0)");
    gradient.addColorStop(0.85, "rgba(255,255,255,0.7)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return finish(context, THREE.SRGBColorSpace);
}
