import type { Rarity } from "@/net/shopApi";
import { resolveTokenColor } from "@/scene/cosmetics";

/* The rarity legend's treatments (docs/brand.md), as atoms.
 *
 * Every colour resolves to a locked brand token - a swatch never carries a
 * literal. The badge class carries the tier treatment; the swatch renders
 * the item's own preview spec.
 */

const TOKEN_VARS: Record<string, string> = {
    background: "--background",
    foreground: "--foreground",
    muted: "--muted",
    "muted-foreground": "--muted-foreground",
    primary: "--primary",
    secondary: "--secondary",
    accent: "--accent",
    destructive: "--destructive",
    border: "--border",
    ring: "--ring",
    "team-2": "--team-2",
};

export function tokenVar(token: string): string | null {
    return TOKEN_VARS[token] ?? null;
}

export const RARITY_LABEL: Record<Rarity, string> = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
};

export const RarityBadge = ({ rarity }: { rarity: Rarity }) => (
    <span className={`rarity-badge rarity-badge--${rarity}`} data-rarity={rarity}>
        {RARITY_LABEL[rarity]}
    </span>
);

/** A preview from its spec: one token, or a gradient between two. */
export const Swatch = ({
    spec,
}: {
    spec: { kind?: string; token?: string; tokens?: string[]; direction?: string };
}) => {
    const style: React.CSSProperties = {};
    if (spec.kind === "gradient" && spec.tokens && spec.tokens.length >= 2) {
        const stops = spec.tokens
            .map((token) => {
                const v = tokenVar(token);
                return v ? `hsl(var(${v}))` : resolveTokenColor(token) ?? "";
            })
            .filter(Boolean);
        style.background = `linear-gradient(${
            spec.direction === "to-bottom-right" ? "135deg" : "90deg"
        }, ${stops.join(", ")})`;
    } else if (spec.token) {
        const v = tokenVar(spec.token);
        if (v) style.background = `hsl(var(${v}))`;
    }
    return <span className="swatch__fill" style={style} />;
};
