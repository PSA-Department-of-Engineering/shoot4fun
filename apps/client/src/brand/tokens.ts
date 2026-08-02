/* Shoot4Fun brand tokens (TypeScript).
 * Mirrors `theme.css` and the 3D scene's material colours.
 * Every HSL value traces back to .delivery/design.md §1.1.
 */

export const BRAND = {
    primary: "12 95% 55%",
    primaryFg: "0 0% 100%",
    team1: "12 95% 55%",
    team2: "195 100% 50%",
    bg: "30 25% 95%",
    fg: "15 10% 12%",
    muted: "30 12% 88%",
    mutedFg: "15 8% 38%",
    accent: "50 100% 50%",
    destructive: "0 72% 51%",
    border: "30 12% 80%",
    ring: "12 95% 55%",
} as const;

/** Parse an HSL triple (`"12 95% 55%"`) into a hex string. */
export function hslToHex(hsl: string): string {
    const [hRaw, sRaw, lRaw] = hsl.split(/\s+/);
    const h = Number(hRaw);
    const s = Number(sRaw.replace("%", "")) / 100;
    const l = Number(lRaw.replace("%", "")) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) {
        r = c;
        g = x;
    } else if (h < 120) {
        r = x;
        g = c;
    } else if (h < 180) {
        g = c;
        b = x;
    } else if (h < 240) {
        g = x;
        b = c;
    } else if (h < 300) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }
    const toHex = (v: number) => {
        const n = Math.round((v + m) * 255);
        return n.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const SCENE_COLORS = {
    arenaGround: hslToHex("35 18% 78%"),
    arenaCover: hslToHex("200 8% 38%"),
    // The boundary wall reads as the same material as cover, a shade
    // lighter, so the arena edge is legible without competing with the
    // cover a player is reading for sightlines.
    arenaWall: hslToHex("200 8% 52%"),
    arenaSky: hslToHex("210 30% 88%"),
    muzzleFlash: hslToHex("50 100% 70%"),
    hitIndicator: hslToHex("50 100% 55%"),
    bullet: hslToHex("50 100% 70%"),
    team1: hslToHex(BRAND.team1),
    team2: hslToHex(BRAND.team2),
    primary: hslToHex(BRAND.primary),
    bg: hslToHex(BRAND.bg),
    fg: hslToHex(BRAND.fg),
    accent: hslToHex(BRAND.accent),
    destructive: hslToHex(BRAND.destructive),
} as const;
