# Shoot4Fun — Brand

> The locked visual identity per `.delivery/design.md` §1.1. The full
> 19-key shadcn set + the 3D-scene colour bindings. Every UI element
> in the build reads these values; a non-token colour anywhere is a
> defect (REF-Design.md §2).

## Canonical 19-key shadcn theme

| Key | HSL | Hex | Source |
| --- | --- | --- | --- |
| `--background` | `30 25% 95%` | `#F5F2EF` | brand palette `--bg` |
| `--foreground` | `15 10% 12%` | `#221D1C` | brand palette `--fg` |
| `--card` | `30 25% 95%` | `#F5F2EF` | same as `--background` |
| `--card-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` |
| `--primary` | `12 95% 55%` | `#F94B1F` | brand palette `--brand` (Hot Sauce) |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | brand palette `--brand-fg` |
| `--secondary` | `30 12% 92%` | `#EDEBE8` | derived: `--bg` shifted toward `--muted` |
| `--secondary-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` |
| `--muted` | `30 12% 88%` | `#E4E0DD` | brand palette `--muted` |
| `--muted-foreground` | `15 8% 38%` | `#695D59` | brand palette `--muted-fg` (Stone) |
| `--accent` | `50 100% 50%` | `#FFD500` | brand palette `--accent` (Gold) |
| `--accent-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` (dark text on gold for WCAG AA) |
| `--destructive` | `0 72% 51%` | `#DC2828` | brand palette `--destructive` |
| `--destructive-foreground` | `0 0% 98%` | `#FAFAFA` | white-ish; mandatory on the destructive red |
| `--border` | `30 12% 80%` | `#D2CCC6` | brand palette `--border` |
| `--input` | `30 12% 80%` | `#D2CCC6` | same as `--border` |
| `--ring` | `12 95% 55%` | `#F94B1F` | brand palette `--ring` |
| `--radius` | `0.5rem` (8px) | — | brand palette `--radius` |
| `--font-sans` | `Inter, system-ui, sans-serif` | — | the body / HUD fallback chain |

## 3D-scene colour bindings

The same palette applied to Three.js materials. The `team-2` cyan is
**not** in the 19-key shadcn set (the brand does not give it a token);
it's applied directly to the material as a hex value.

| Surface | HSL | Hex |
| --- | --- | --- |
| Arena ground | `35 18% 78%` | `#D1C9BD` (Sand) |
| Arena walls / cover | `200 8% 38%` | `#596369` (Slate) |
| Sky / fog | `210 30% 88%` | `#D7E0EA` |
| Muzzle flash | `50 100% 70%` | `#FFE666` |
| Hit indicator | `50 100% 55%` | `#FFD91A` |
| Bullet / projectile | `50 100% 70%` | `#FFE666` |
| Team 1 (player) | `12 95% 55%` | `#F94B1F` (same as brand) |
| Team 2 (player) | `195 100% 50%` | `#00BFFF` (Cyan) |

## Typography

The build self-hosts four Google Fonts. No `@import` from Google Fonts
at runtime; the four WOFF2 files live in `apps/client/public/fonts/`.

| Role | Family | Weight | Size |
| --- | --- | --- | --- |
| Wordmark | Russo One (Bungee as alt) | 900 | 56–76 px |
| HUD display | Bungee | 400 | 28–40 px |
| Body | Inter | 400–600 | 14–16 px |
| Mono (codes) | JetBrains Mono | 500 | 18–24 px |

The **Wordmark** role applies to two surfaces in the build: the
"SHOOT4FUN" splash lockup (`apps/client/src/main.ts`) and the "MATCH
OVER" results banner (`apps/client/src/ui/Surface.ts`). There is no
standalone kill-count-header surface — per-match kill counts render in
the HUD at the **HUD display** scale, not the Wordmark role.

## Logo

| Asset | Path | Source | License |
| --- | --- | --- | --- |
| Wordmark + crosshair lockup | `docs/logo.svg` | original | MIT |
| Monogram (favicon) | `docs/logo-monogram.svg` | original | MIT |

Rasters produced by `@resvg/resvg-js` with the WOFF2 fonts in the
build context; the fallback (`<text>`→`<path>`) is used when the
font isn't resolvable at build time. Output files:

- `apps/client/public/favicon.ico` (32×32, from monogram)
- `apps/client/public/apple-touch-icon.png` (180×180, from monogram)
- `apps/client/public/icon-192.png` (PWA, from monogram)
- `apps/client/public/icon-512.png` (PWA splash, from monogram)
- `docs/logo.png` (600×160, from wordmark — README header)
