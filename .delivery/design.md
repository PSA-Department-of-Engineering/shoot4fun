---
phase: design
skill: design-session
status: complete
gate: design
signed: 2026-08-19
reviewed: 2026-08-19
run: s4f-lp-001
attempt: 1
mode: interactive
started: 2026-08-19T17:29:25Z
finished:
credential_ref: protopane-mcp
---

# Design - shoot4fun

The design phase's record: the locked visual identity, the one design artifact that survives (REF-Delivery.md section 3). The design phase locks it here in the committed delivery scratch; the build lands it into the app's `docs/` (a brand page, the committed logo asset, and these values as the frontend theme tokens); reconcile confirms it in `docs/` and deletes the scratch. `docs/` is its durable home; do not maintain this scratch copy.

## Logo

`docs/logo.svg` (committed asset; the build lands it into docs/ as the app's logo)

## Colour scheme

```css
:root {
    --background: 30 25% 95%;
    --foreground: 15 10% 12%;
    --card: 30 25% 95%;
    --card-foreground: 15 10% 12%;
    --primary: 12 95% 55%;
    --primary-foreground: 0 0% 100%;
    --secondary: 30 12% 92%;
    --secondary-foreground: 15 10% 12%;
    --muted: 30 12% 88%;
    --muted-foreground: 15 8% 38%;
    --accent: 50 100% 50%;
    --accent-foreground: 15 10% 12%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 30 12% 80%;
    --input: 30 12% 80%;
    --ring: 12 95% 55%;
    --radius: 0.5rem;
}
```

## Typography

- `--font-sans`: Inter, system-ui, sans-serif

The prototype renders system stacks. Any brand webfont (a curated display or body face) is pinned here and self-hosted at build, never a CDN.

## Art direction

The three new surfaces (account/opt-in login, profile, arsenal) inherit
Shoot4Fun's delivered brand **without modification**: warm off-white canvas
(`#F5F2EF`), coral-red primary (`#F94B1F`), gold accent (`#FFD500`), `0.5rem`
radius, Russo One / Bungee display faces with Inter body. Every card carries
the one-pixel primary→accent top stripe already used across the app. **No new
hue, font, or shape is introduced** — a follow-on line reuses the locked
identity (REF-Delivery.md section 1), it does not re-style. The build must
render these surfaces identically to the rest of the app, sourcing the same
tokens from `apps/client/src/brand/theme.css`. The prototype's top-stripe
gradient is the one flourish to confirm against `brand.md` at build (it is
token-derived, `from-primary to-accent`); adopt or drop it, but do not
invent a different treatment.

## Interaction model

- **Account / opt-in login:** "Keep this name" opens the register dialog
  (display-name field); "Sign in" opens the recovery-code dialog (name +
  code). Both are optional — guests play without either, login never blocks a
  match (LOGIN-001/002). The prototype shows the guest panel plus the
  sign-in dialog; the recovery-code *reveal* state lives in the existing
  `AccountPanel` flow.
- **Profile:** read-only display of server-synced preferences (crosshair,
  mouse sensitivity, audio) plus a "Synced" status; local changes reconcile
  to the server-side profile automatically (PROF-001/002/003). Editing
  happens through the existing settings dialogs, not a new editor this phase.
- **Arsenal:** the main-menu `arsenal` tile (currently `status: "soon"`)
  opens the Arsenal view. The operator/model panel is a **placeholder** until
  the 3D character viewer lands; the inventory/loadout panel renders
  **gracefully empty** with a "Browse shop" affordance. The shop surface is
  deferred (out of scope this phase).
- **Out of scope this phase:** the shop surface, 3D player-model rendering,
  and weapon-unlock flows (ARS data shape stays forward-compatible, no
  breaking change).

## Accessibility

Same bar as the delivered app. Token-driven contrast meets WCAG AA: primary
`#F94B1F` carries white foreground; gold accent `#FFD500` carries the dark
foreground token for AA on text. Controls stay keyboard-operable via the
existing `Button` / `TextField` / `FormField` atoms, and `prefers-reduced-
motion` is already honoured in `theme.css`. The arsenal placeholder and
empty-state copy must remain legible at the `muted-foreground` token. No new
interactive pattern is introduced, so no new a11y surface is opened.

## Design approval (the design gate, REF-Delivery.md section 1)

- Design approved: 2026-08-19 - approved by CarlosDSkills in the live design session, over the phase's passing fresh-eyes review (both recorded in the frontmatter `signed:` and `reviewed:` fields above, the authoritative gate state; REF-Delivery.md section 1)
- Approved layout: Shoot4Fun locked brand - account / profile / arsenal screens
- Prototype (legacy reference, kept live): https://protopane.chaos-architect.dev/p/shoot4fun; read its screens later via the Protopane MCP (https://protopane.chaos-architect.dev/mcp) or `GET https://protopane.chaos-architect.dev/api/projects/shoot4fun`, credentials from the environment (REF-Protopane.md section 9). The MCP/deployed instance is the door, never a local clone.

> Gate closed: design signed 2026-08-19 by CarlosDSkills over a passing fresh-eyes review (REF-Delivery.md section 1; artifact `.delivery/reviews/design-2026-08-19.md`). Prose above predates the closure.
