---
phase: design
skill: design-session
status: complete
gate: design
signed: 2026-08-21
reviewed: 2026-08-21
run: 
attempt: 1
mode: interactive
started: 2026-08-21T16:44:32Z
finished:
credential_ref: protopane (from environment)
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

Warm workshop palette (Hot Sauce orange on sand), card-based surfaces with a primary-to-accent hairline; rarity tiers are the only new colour semantics: Common=outlined muted, Uncommon=secondary fill, Rare=primary fill, Epic=accent fill with dark text, Legendary=primary-to-accent gradient with dark text.

## Interaction model

Catalog cards are whole-card links (data-item-link) to the detail page; Unlock lives only on detail; unlock writes the ADR-0007 ownership record and auto-equips, confirmed on the Acquired screen; Back paths: detail->catalog, catalog->arsenal. Out of scope: currency/pricing, cases, gacha.

## Accessibility

WCAG AA body text; dark-on-gold/dark-on-gradient for accent and Legendary badges per brand.md; known accepted gap: white-on-orange small badges (~3.6:1) inherit the locked token pair - surface at acceptance demo.

## Design approval (the design gate, REF-Delivery.md section 1)

- Design approved: 2026-08-21 - approved by the operator in the live design session, over the phase's passing fresh-eyes review (both recorded in the frontmatter `signed:` and `reviewed:` fields above, the authoritative gate state; REF-Delivery.md section 1)
- Approved layout: Shop · Catalog → Item Detail → Acquired & Apply
- Prototype (legacy reference, kept live): https://protopane.chaos-architect.dev/p/shoot4fun; read its screens later via the Protopane MCP (https://protopane.chaos-architect.dev/mcp) or `GET https://protopane.chaos-architect.dev/api/projects/shoot4fun`, credentials from the environment (REF-Protopane.md section 9). The MCP/deployed instance is the door, never a local clone.

> Gate closed: design signed 2026-08-21 by the operator over a passing fresh-eyes review (REF-Delivery.md section 1; artifact `.delivery/reviews/design-2026-08-21.md`). Prose above predates the closure.
