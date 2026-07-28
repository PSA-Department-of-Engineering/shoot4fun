---
phase: design
skill: design-session
status: complete
gate: design
signed: 2026-07-28
reviewed: 2026-07-28
run: shoot4fun-2026-07-28
attempt: 1
mode: interactive
started: 2026-07-28T00:00:00Z
finished: 2026-07-28T00:00:00Z
credential_ref: protopane-mcp
prototype:
  url: https://protopane.chaos-architect.dev/p/shoot4fun
  instance: https://protopane.chaos-architect.dev
  slug: shoot4fun
  reachable_via: protopane-mcp
  note: >
    Live Protopane project. The DOM surfaces (lobby, results, settings) are
    prototyped here as token-backed markup reading the locked brand theme;
    the live theme tokens in the project match §1.1 below. The 3D playable
    surface is still prose in this record, not prototyped — per REF-Delivery.md
    §3, the prototyping hub themes shadcn DOM components and is the wrong
    tool for a WebGL / Three.js scene. A later reader can re-open the
    project at the editor URL above, or read it through the Protopane MCP
    (protopane_get_project) which returns the same theme + screens
    without requiring browser access.
---

# Design — Shoot4Fun

> **Why a partial prototype.** Shoot4Fun's *playable* surface is a Three.js
> WebGL multiplayer shooter: a 3D scene with a canvas-rendered HUD. The
> prototyping hub (REF-Protopane.md) themes shadcn DOM components, and a
> full prototype of the playable surface would force the visual identity
> through a tool that does not match the domain. Per REF-Delivery.md §3
> ("3D scenes, canvas or WebGL rendering, generative or game-like
> visuals"), the dimensions the build will implement for the 3D scene
> are captured as prose in this record, not as a Protopane prototype. The
> DOM surfaces the engagement also ships — `MAT-001` (lobby → playing →
> results) — ARE prototyped on the live instance, with token-backed
> markup reading the locked brand theme: the live project carries
> `lobby`, `results`, and `settings` screens (the per-match results
> leaderboard serves `SCO-001`; the persistent best-score leaderboard
> `LDR-002` is a separate P2 surface not yet designed and deferred to a
> P2 design pass — it will follow the same leaderboard treatment as the
> per-match results, with brand-coloured 1st place). The logo is the one
> artifact this phase must commit (REF-Delivery.md §3: "A delivery that
> produces no logo has skipped this step"), so a deliberate wordmark is
> the floor; it is committed at `docs/logo.svg` and embedded as an
> inline SVG mark in the prototyped DOM screens.

## Customer request (verbatim)

> simple multiplayer threejs shooter

The visual identity is the design-phase answer to that ask: a look that
reads as **playful, fast, and readable** in a 3D scene, with a brand
treatment that survives the `simple` token — no chrome, no clutter, no
decorative surface that gets in the way of the gameplay the build will
ship.

## Art direction (one falsifiable paragraph)

> Shoot4Fun is a low-poly, flat-shaded Three.js FPS with a punchy
> coral-red brand and a complementary cyan team tint, set on a warm sand
> arena with slate-grey cover. The wordmark is a chunky display sans
> ("SHOOT4FUN") with a circular crosshair mark; the HUD is a clean
> sans-serif with oversized numbers and high-contrast white-with-black-
> outline overlays that stay readable against any arena colour. There are
> no textures, no skeuomorphism, no postprocessing heavy enough to dent
> framerate; the look is the geometry plus the colour. A 6–8-second match
> in this look reads as a toy you can win in, not a mil-sim you grind.

Every claim in this paragraph is testable against the built scene: the
build is wrong if the geometry is textured, if the brand is not
coral-red, if the HUD numbers fall under 24px, if a single non-token
colour appears in the lobby, or if the framerate drops below 60 on the
target hardware because of the look.

## 1. Visual identity (the locked tokens)

These are the **durable** tokens. The build drops them into the
frontend's `docs/brand.md` and into the DOM surfaces (lobby, results,
menus) as the theme tokens. The 3D scene reads the same palette values
into its material colours.

> **Canonical theme shape.** The locked theme saved on the live Protopane
> project (`https://protopane.chaos-architect.dev/p/shoot4fun`) is the
> full 19-key shadcn token set (REF-Protopane.md §3), not a brand
> subset: every key is set, the four `-foreground` keys are paired with
> their base, and `--font-sans` carries the Inter system-font stack the
> HUD and lobby fall back to. The brand-palette table below is the
> *narrative slice* — the surface roles the design calls out — and is
> a projection of the canonical theme, not a replacement. The build
> uses the full theme; this section names the role each role plays.

### 1.1 Brand palette (HSL triples — same shape as the shadcn theme Protopane uses)

| Role | HSL | Hex | Notes |
| --- | --- | --- | --- |
| `--brand` (primary action) | `12 95% 55%` | `#F94B1F` | "Hot Sauce" — the crosshair, the wordmark accent on the `4`, the kill highlight, the primary CTA. |
| `--brand-fg` (text on brand) | `0 0% 100%` | `#FFFFFF` | Pure white; mandatory on the coral-red brand. |
| `--team-1` (player 1 tint) | `12 95% 55%` | `#F94B1F` | Same hue as brand; carries the brand through the scene. |
| `--team-2` (player 2 tint) | `195 100% 50%` | `#00BFFF` | "Cyan" — the classic shooter team split, the only place a second brand-strength colour is allowed. |
| `--bg` (menu / lobby / results surface) | `30 25% 95%` | `#F5F2EF` | Warm off-white "Bone". |
| `--fg` (body text) | `15 10% 12%` | `#221D1C` | Near-black, warm. Never pure `#000000`. |
| `--muted` (low-emphasis surface) | `30 12% 88%` | `#E4E0DD` | Slightly darker than `--bg`; dividers and card backgrounds. |
| `--muted-fg` (captions) | `15 8% 38%` | `#695D59` | Stone. |
| `--accent` (highlights, badges) | `50 100% 50%` | `#FFD500` | "Gold" — kill feeds, best-score row, hit indicators. |
| `--destructive` (errors) | `0 72% 51%` | `#DC2828` | The few seconds before respawn; reserve it. |
| `--border` | `30 12% 80%` | `#D2CCC6` | Hairline. |
| `--ring` (focus) | `12 95% 55%` | `#F94B1F` | Same as brand. |
| `--radius` (DOM) | `0.5rem` (8px) | — | All menu cards and buttons. |

**3D-scene colour bindings (the same palette applied to materials, not tokens):**

| Surface | HSL | Hex | Notes |
| --- | --- | --- | --- |
| Arena ground | `35 18% 78%` | `#D1C9BD` | Sand; reads warm against the cool sky. |
| Arena walls / cover | `200 8% 38%` | `#596369` | Slate; never pure grey. |
| Sky / fog | `210 30% 88%` | `#D7E0EA` | Cool pale; gives depth. |
| Muzzle flash | `50 100% 70%` | `#FFE666` | Warm yellow; short-lived. |
| Hit indicator | `50 100% 55%` | `#FFD91A` | Gold; brief. |
| Bullet / projectile | `50 100% 70%` | `#FFE666` | Glow trail. |

A non-token colour anywhere in the build is a defect (REF-Design.md §2).

#### 1.1.1 Canonical 19-key theme (the full set the prototype carries)

The brand-palette table above is the narrative slice — 13 named roles
the design calls out. The locked theme saved on the Protopane project
(`https://protopane.chaos-architect.dev/p/shoot4fun`) is the full
19-key shadcn canonical set, so a build landing the identity into
`docs/brand.md` without the prototype has every key below. The 6 keys
not in the narrative table project from the brand palette by the
rules in the right column.

| Key | HSL | Hex | Source |
| --- | --- | --- | --- |
| `--background` | `30 25% 95%` | `#F5F2EF` | brand palette `--bg` |
| `--foreground` | `15 10% 12%` | `#221D1C` | brand palette `--fg` |
| `--card` | `30 25% 95%` | `#F5F2EF` | same as `--background` (cards and page share the surface in this brand) |
| `--card-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` |
| `--primary` | `12 95% 55%` | `#F94B1F` | brand palette `--brand` |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | brand palette `--brand-fg` |
| `--secondary` | `30 12% 92%` | `#EDEBE8` | derived: `--bg` shifted one stop toward `--muted` (a quieter alternative surface) |
| `--secondary-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` |
| `--muted` | `30 12% 88%` | `#E4E0DD` | brand palette `--muted` |
| `--muted-foreground` | `15 8% 38%` | `#695D59` | brand palette `--muted-fg` |
| `--accent` | `50 100% 50%` | `#FFD500` | brand palette `--accent` |
| `--accent-foreground` | `15 10% 12%` | `#221D1C` | same as `--foreground` (dark text on the gold accent for WCAG AA contrast) |
| `--destructive` | `0 72% 51%` | `#DC2828` | brand palette `--destructive` |
| `--destructive-foreground` | `0 0% 98%` | `#FAFAFA` | white-ish; mandatory on the destructive red |
| `--border` | `30 12% 80%` | `#D2CCC6` | brand palette `--border` |
| `--input` | `30 12% 80%` | `#D2CCC6` | same as `--border` (the form-field border is the same as the surface border in this brand) |
| `--ring` | `12 95% 55%` | `#F94B1F` | brand palette `--ring` |
| `--radius` | `0.5rem` (8px) | — | brand palette `--radius` |
| `--font-sans` | `Inter, system-ui, sans-serif` | — | the body / HUD fallback chain (the brand wordmark uses Russo One / Bungee, loaded only for the wordmark, not as the default `--font-sans`) |

The team-2 colour (`195 100% 50%`, `#00BFFF`, "Cyan") is **not** in the
canonical 19-key set; the brand does not give it a token. Where the
build needs a second team tint (the 3D scene's team-2 material, any
in-game surface that distinguishes teams), it is a direct HSL value
applied to the Three.js material, not a CSS variable — same shape as
the 3D material bindings in the table above.

### 1.2 Typography

The build self-hosts four Google Fonts; the brand wordmark "SHOOT4FUN"
favours Russo One or Bungee (the build may pick; this record lets the
build pick the closest open-source match to the locked look).

| Role | Family | Weight | Size | Use |
| --- | --- | --- | --- | --- |
| Wordmark | Russo One (Bungee as alt) | 900 | 56–76px | "SHOOT4FUN" lockup; kill-count headers; results banner. |
| HUD display | Bungee | 400 | 28–40px | Ammo count ("30 / 90"), HP number, countdown. |
| Body | Inter | 400–600 | 14–16px | Lobby, results, settings. |
| Mono (codes) | JetBrains Mono | 500 | 18–24px | Room code, network stats, debug overlay. |

> **Build note.** If the build lands a Three.js HTML overlay for the
> HUD, use Bungee for the numbers; if the HUD is canvas-rendered, render
> the numbers with a self-hosted Bungee WOFF and rasterise on the fly
> (the framerate target is 60fps on a mid-range desktop GPU). Self-host
> the four families in `apps/client/public/fonts/`; no `@import` from
> Google Fonts at runtime.

### 1.3 Logo

| Asset | Path | Format | Use |
| --- | --- | --- | --- |
| Wordmark + crosshair lockup | `docs/logo.svg` | SVG (1 file) | Primary lockup. Used at full size in the lobby header, the results banner, the readme header (rasterised to `docs/logo.png` and `<img>`-embedded), and the in-game splash overlay if one is added. **Not used for any square / favicon-scale context** — see the monogram row. |
| Monogram (favicon) | `docs/logo-monogram.svg` | SVG (1 file) | The favicon. A crosshair ring with the digit `4` at the centre, in brand primary. Designed at 64×64 viewBox so it rasterises legibly at 32×32 (the standard favicon size) and tolerably at 16×16 (the browser tab size — the `4` glyph resolves to ~8px and the crosshair ring is still visible). Used for the favicon and any context where the full lockup is too small to read. |
| Inline wordmark (in DOM screens) | embedded as `<svg>` in `lobby`, `results`, `settings` | inline SVG | The same lockup, drawn with `stroke="currentColor"` and `fill="currentColor"` on the crosshair ring/ticks/centre dot; the parent `<div>` sets `class="text-primary"` so the brand flows through via the `currentColor` cascade and the wordmark recolours automatically in dark mode. |

The wordmark uses the brand primary (`#F94B1F`, the HSL→hex of
`--primary: 12 95% 55%`) for the crosshair and the `4` glyph, with
`#221D1C` (the HSL→hex of `--foreground: 15 10% 12%`) for the
surrounding letters. No tagline ships in the logo. The monogram is a
single-colour brand-primary mark with the `4` in the same hue — it
is the favicon and any compact context (avatar, PWA tile at 192×192,
social-card fallback), not a wordmark substitute.

### 1.4 Rasterisation strategy (the build's path from SVG to pixels)

Both logo assets use `<text>` for the `4` glyph (and the wordmark uses
`<text>` for the whole "SHOOT4FUN" word), which means the rasteriser
must resolve the font. The build's strategy is **pin resvg-js
(`@resvg/resvg-js`) as the rasteriser and pass the font files in the
build context**, with one of two fallbacks:

| Approach | When to use | Trade-off |
| --- | --- | --- |
| **resvg + font file in build context** (preferred) | the build's rasterisation step (favicon, app icon, README header) runs in Node, where resvg is available and the `apps/client/public/fonts/` WOFF2 files can be read | text renders with the actual Russo One / Bungee glyphs; matches the brand wordmark weight exactly |
| **Convert `<text>` to `<path>` at scaffold** (fallback) | the rasteriser can't resolve the font, or the build target is a constrained environment (e.g., a static-site generator that runs at deploy time without the font files) | output is font-independent; the wordmark is locked to the chosen weight forever; no re-rasterisation if the font choice changes |

Whichever path the build picks, the rasterisation produces:

| Output | Source | Size | Path |
| --- | --- | --- | --- |
| `apps/client/public/favicon.ico` | `docs/logo-monogram.svg` | 32×32 | browser tab favicon |
| `apps/client/public/apple-touch-icon.png` | `docs/logo-monogram.svg` | 180×180 | iOS home-screen icon |
| `apps/client/public/icon-192.png` | `docs/logo-monogram.svg` | 192×192 | PWA manifest, Android home-screen |
| `apps/client/public/icon-512.png` | `docs/logo-monogram.svg` | 512×512 | PWA splash |
| `docs/logo.png` | `docs/logo.svg` | 600×160 (1×) and 1200×320 (2×) | README header, embedded as `<img src="docs/logo.png" alt="Shoot4Fun">` |

The README at `D:\Personal\shoot4fun\README.md` is plain Markdown and
cannot embed SVG cleanly; the build replaces the existing 2-line
README with one that has the rasterised PNG as the header (an
`<img>` block is valid in GitHub-flavoured Markdown). No HTML
`<picture>` block is needed.

## 2. Throwaway build guidance (the dimensions the prototype cannot carry)

The 3D scene is a canvas, not a DOM tree, so the design-session
rubric's presentable dimensions are all un-presentable here. The
following is the build's reference for the look, structured the way
the build consumes it.

### 2.1 Arena (the playable surface)

- **Geometry**: bounded flat ground plane (one material), 6–8 cover
  blocks per arena (mix of low walls ~1.5m tall, crates ~1m cubes, two
  barrels per arena as cylinders). MVP ships one arena; the design
  is single-arena (MAP-001).
- **Materials**: flat-shaded `MeshStandardMaterial` with low metalness
  (0.05) and low roughness (0.8). No textures, no normal maps, no
  PBR. The colour does the work.
- **Lighting**: one hemisphere light (sky `#D7E0EA`, ground
  `#D1C9BD`, intensity 0.6) and one directional light (warm
  `#FFF0D8`, intensity 0.8) from above-and-behind the players; no
  shadows in MVP (the perf budget is the constraint). Add basic
  shadows in P2 if the budget allows (VFX-002).
- **Sky / fog**: `THREE.Fog` linear, near=40, far=120, colour
  `#D7E0EA`; the arena reads as a small pocket of action in a
  washed-out distance.
- **Player model**: capsule body (height 1.6, radius 0.35) + sphere
  head (radius 0.22), no arms, no legs. Team tint via material
  colour. The capsule is the entire avatar; the FPS camera is
  independent.

### 2.2 HUD (canvas overlay)

> **WPN-002 (P2) shared chrome.** The two weapons the P2 plan adds
> share the HUD chrome defined in this section — one crosshair, one
> ammo display. "Different feel" in the proposal is gameplay-only:
> rate of fire, magazine size, damage, and reload time vary per
> weapon; the visual treatment does not. The build may diverge in
> P2 (per-weapon crosshair, muzzle-flash tint) without re-opening
> this gate.

| Element | Position | Style | Notes |
| --- | --- | --- | --- |
| Crosshair | screen centre | 4 ticks (NSEW, 6px long × 2px wide), 1px gap, then 2px black outline, white core, 4px black centre dot | High contrast against any arena colour; lives at 0,0 of the overlay. |
| Health bar | top-left, 24px from edges | 240×16, brand red fill, `--bg` track, HP integer above the bar in Bungee 28px | The bar is the only coloured HUD element besides the crosshair. |
| Ammo | top-right | "30 / 90" in Bungee 36px, near-black with 1px white shadow | Big, readable at peripheral glance. |
| Scoreboard summary | top-centre | small "KILLS · DEATHS" in Inter 14px, numbers in Bungee 24px | Reads as a tiny stat strip. |
| Hit indicator | centre, on hit | 60ms red ring at the screen edge in the direction of damage | 4 arrows (N/E/S/W) fade in 100ms, fade out 400ms. |
| Respawn overlay | full screen, 1.5s before respawn | "RESPAWNING IN 3..." in Bungee 64px centred, semi-transparent `--bg` backdrop | The only moment a full-screen element appears. |
| Network stats (debug) | bottom-right | small mono, only when `?debug=1` | Out of the player's normal view. |

### 2.3 Lobby, results, and settings (DOM surfaces, read the brand tokens)

- **Lobby**: centred card, max-width 28rem, 1px `--border` with a
  `--brand` 4px top accent. Title "ROOM `XYZ123`" in Bungee
  36px (room code in JetBrains Mono). Player list as a 2-column
  grid of small cards (avatar circle in team tint + Inter 16px
  name). "READY" toggle button + "START MATCH" button (host only,
  disabled until ≥2 ready). Background: subtle 1px grid pattern in
  `--muted`.
- **Results**: full-width leaderboard (Inter 16px rows). 1st place
  in `--brand` background with `--brand-fg` text. "REMATCH" button
  below the table. A small "SHOOT4FUN" wordmark centred at the
  top of the page (the locked logo, recoloured if the page is in
  dark mode — see §3).
- **Settings** (DOM, in the prototype): a `settings` card with three
  sub-cards — *Audio* (master volume + SFX volume range inputs with
  `--brand` accent on the slider thumb), *Mouse* (sensitivity range
  + invert-Y toggle), and *Keybinds* (a one-row-per-action list of
  `W` / `S` / `A` / `D` / Click / `R` / `ESC` with `kbd`-style
  chips). "Discard" + "Save" footer. All values persist to
  `localStorage` under namespaced keys (`sf_master_volume`,
  `sf_sfx_volume`, `sf_sensitivity`, `sf_invert_y`); the Mute
  toggles named in §4 (`M` master, `S` SFX) flip the same keys
  without opening the screen. The card is the only place the
  pointer-lock toggle lives (on by default, off when the user has
  denied pointer-lock and is using keyboard-look — see §4).
- **Persistent best-score leaderboard** (`LDR-002`, P2) is **not yet
  designed**; it is deferred to a P2 design pass and will follow the
  per-match results treatment above (a list with brand-coloured 1st
  place), reachable from a tab in the lobby or the results page.

### 2.4 Interaction model (what is clickable, what happens)

| Surface | Action | Behaviour |
| --- | --- | --- |
| First load | click anywhere | Request pointer-lock; show "CLICK TO PLAY" prompt. |
| In-game | click | Fire (SHO-001); release pointer-lock only on ESC. |
| In-game | mouse move | Look (CAM-001). |
| In-game | W / A / S / D | Move (MOV-001). |
| In-game | R | Reload (P2, WPN-002). |
| In-game | 1 / 2 | Switch weapons (P2, WPN-002). |
| In-game | ESC | Open pause menu; release pointer-lock; "QUIT MATCH" returns to lobby. |
| Lobby | "READY" toggle | Marks the player ready; "START MATCH" enables for the host when all ready. |
| Results | "REMATCH" | Host-only; resets match state and returns players to the lobby. |
| Network failure | any | Toast "DISCONNECTED — RETURNING TO LOBBY"; auto-return after 3s. |

The build's accessibility bar (§4) covers what every player can do
when one channel is unavailable.

### 2.5 Imagery and sound

- **3D models**: all geometry is built from `THREE.BoxGeometry`,
  `THREE.CylinderGeometry`, `THREE.SphereGeometry`, and
  `THREE.CapsuleGeometry`. No GLTF, no external models, no
  textures. The look is procedural geometry + brand palette.
- **Sound (SND-002)**: four families — shot, hit, footstep, UI
  sting. Web Audio API generated (no external samples): a
  200ms short noise burst for the shot, a 100ms filtered noise
  for the hit, a 50ms click for the footstep, a short oscillator
  triad for the match-start horn and the results sting. Master
  volume is a `localStorage` setting (`sf_volume`).
- **No stock photography, no real-world imagery, no third-party
  assets.** The brand is a wordmark and a palette; the look is
  geometry.

### 2.6 Reference imagery (none; nothing to credit)

The brand is original. No reference image is used (REF-Design.md §3:
"reinterpreted, never copied"). The crosshair mark is a stock
geometry circle + ticks; the wordmark is a Google Font; the colour
choices are an original interpretation of "simple multiplayer threejs
shooter" through the brand's playful, fast, readable direction.

## 3. Dark mode

The MVP ships light only. Dark mode is a follow-on; when shipped, the
brand accent (`--brand` coral-red) carries through unchanged (per
REF-Protopane.md §3: "Keep the brand accent across light and dark").
A dark scheme lives in `docs/brand.md` as a second token set once the
build lands the brand page.

## 4. Accessibility bar

| Bar | Floor |
| --- | --- |
| HUD number size | ≥ 24px (Bungee) — HP, ammo, score |
| HUD secondary text | ≥ 14px (Inter) |
| Crosshair contrast | 4.5:1 against any arena background (use 2px black outline + 1px white core) |
| Team distinction | colour **plus** a shape — Team 1 = circle marker, Team 2 = triangle marker, on the player capsule |
| Audio cues paired with visuals | every audio cue has a paired visual indicator (hit indicator, respawn countdown, lobby ready check) |
| Mute / volume | `M` toggles master mute, `S` toggles SFX, settings persist in `localStorage` |
| Pointer-lock failure | if pointer-lock is denied, show a "Click to enable mouse-look" overlay; WASD still works without pointer-lock (CAM-001 degrades to keyboard-look via arrow keys) |
| Motion sensitivity | none in MVP; P2 adds a reduce-motion toggle for hit-indicator fade |

## 5. Logo and asset list (committed, no third-party)

| Asset | Path | Source | License | Notes |
| --- | --- | --- | --- | --- |
| Wordmark + crosshair lockup | `docs/logo.svg` | original | MIT (per proposal `License: MIT`) | The primary brand lockup. Rasterised to `docs/logo.png` (and 2×) for the README header. **Not used at square / favicon scale** — the 192×192 and 512×512 PWA icons are rasterised from the monogram (see below and §1.4). The wordmark is 600×160 landscape and would be illegible if rasterised to a square. |
| Monogram (favicon) | `docs/logo-monogram.svg` | original | MIT | Crosshair ring + NSEW ticks + centre "4" in brand primary, 64×64 viewBox. Source for `apps/client/public/favicon.ico` (32×32), `apple-touch-icon.png` (180×180), `icon-192.png`, and `icon-512.png`. The full lockup would be illegible at favicon scale; the monogram is the favicon-grade variant. |
| Fonts (Russo One, Bungee, Inter, JetBrains Mono) | `apps/client/public/fonts/` | Google Fonts | OFL (open font license) | Self-hosted; no runtime Google Fonts import. The wordmark uses Russo One / Bungee; the body / HUD falls back to Inter. |
| Sound | generated at runtime via Web Audio API | procedural | n/a | No audio files in the repo. |
| 3D models | procedural | `THREE.*Geometry` | n/a | No GLTF, no third-party models. |

## 6. Prototype pointer

| Pointer | Value |
| --- | --- |
| Editor URL | `https://protopane.chaos-architect.dev/p/shoot4fun` |
| Instance | `https://protopane.chaos-architect.dev` |
| Slug | `shoot4fun` |
| Reachable via | the Protopane MCP `protopane_get_project` (no browser needed) |
| Theme | locked brand theme (full 19-key set, see §1.1) |
| Screens | `lobby`, `results`, `settings` (the DOM surfaces `MAT-001` and `LDR-002` cover) |
| Out of prototype | the playable 3D scene (`REN-001`, `CAM-001`, `MOV-001`, `SHO-001`, `HP-001`, `MAP-001`, `COL-001`, `WPN-002`, `SND-002`, `VFX-002`) — captured as prose in §2 |

The 3D-scene dimensions (arena geometry, HUD overlay, player model,
lighting, materials) live as prose because Protopane is the wrong tool
for a WebGL surface; a build reading this record has everything it
needs to land the look without inventing.

## 7. Design gate

The gate closes when the visual identity is locked and the operator
approves. Per `REF-Delivery.md` §1 the only writer of `signed:` is
`stamp_gate.py`; the helper refuses without a passing fresh-eyes
review.

| Field | Value |
| --- | --- |
| Status | `gate` once this record is in gate-ready form (frontmatter present, dimensions covered, logo committed) |
| Signed | date the operator approves (helper-stamped) |
| Reviewed | date the design phase's fresh-eyes review passed (helper-stamped) |
