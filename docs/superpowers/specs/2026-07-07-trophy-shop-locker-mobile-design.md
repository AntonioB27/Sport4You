# Trophy Track, Shop & Locker — Mobile Layouts (1a / 1c / 1e)

## Context

The Achievements ("Trophy Track"), Shop, and Avatars/Locker pages are desktop-first:
each has a single `@media (max-width: 900px)` rule that does light reflow (stack
the spotlight, collapse a grid column) but no real `<768px` mobile treatment. The
app's shell already swaps a sidebar for a bottom tab bar at 768px
(`app.component.ts`), and that bottom nav's five tabs (Home/Badges/Log/Shop/Avatars)
already match the tab bar drawn in the Claude Design mockups.

Three mockup variants from the "Mobile Redesign - Trophy Track Shop Locker" design
project are being implemented, chosen from six explored (1a/1b, 1c/1d, 1e/1f):

- **1a** — Achievements: sticky tier + category filter chips over a compact 3-col grid
- **1c** — Shop: featured box pinned on top + a Boosters/Boxes/Avatars segmented control
- **1e** — Locker: compact equipped-avatar header + Avatars/Borders toggle + category
  chips over a 3-col porthole grid

## Goal

Give each of these three pages a real mobile layout (`<768px`) with the filtering/
tab interactions the mockups introduce, without touching desktop behavior, without
new API calls, and without introducing a `BreakpointObserver` — the app's existing
pattern is a second CSS-gated markup block, and this follows it.

## Non-goals

- No changes to the Shop's actual purchase flow, coin economy, or backend
- No changes to desktop layout/interactions for any of the three pages
- No changes to the bottom nav itself (already matches the mockups)
- 1b/1d/1f (the alternate carousel/accordion variants) are not being built

## Approach

Each of the three components gets a second template block, rendered from the same
bound data as desktop, gated by CSS: a `.mobile-view` wrapper hidden via
`display:none` above 768px, and the existing desktop markup wrapped in a
`.desktop-view` hidden below 768px. This mirrors how `app.component.ts` already
swaps `.sidebar` for `.bottom-nav`. No duplicate HTTP requests — both views read
the same component fields.

New interactive state (filter chips / segmented tabs) is added as plain component
fields + getters, scoped to the mobile block. Angular's `@if`/`@for` blocks re-run
on both trees, so filtering only recomputes the array that's actually visible.

### 1a — Achievements mobile

`achievements.component.ts`:
- New fields: `activeTier: 'all' | 'bronze' | 'silver' | 'gold' = 'all'`,
  `activeCategory: string | null = null` (category = a `SECTIONS` label, e.g.
  "Sport Distance Milestones"; `null` = all categories)
- New getter `mobileFiltered(): AchievementStatus[]` — filters `achievements` by
  tier (skip if `'all'`) and by category (map `activeCategory` back to the
  matching `SECTIONS` entry's `requirementType`/`sport` combos, or include
  one-time feats when `activeCategory` is the "One-time" chip)
- Mobile markup: sticky bar (HUD condensed to title + `X/Total` count, tier chip
  row, category chip row) → existing "latest unlock" spotlight (kept, already
  responsive) → 3-col CSS grid of `<app-achievement-card>` over `mobileFiltered()`
  — no rail connectors (mockup drops them in favor of filtering)
- Platinum tier (used by one-time mythic feats per `TIER_META`) has no chip;
  those cards show under the "All" tier or the "One-time" category chip only

### 1c — Shop mobile

`shop.component.ts`:
- New field: `activeSegment: 'boosters' | 'boxes' | 'avatars' = 'boosters'`
- Mobile markup: HUD + coin counter → featured special-box spotlight (kept,
  already responsive) → segmented control (3 buttons setting `activeSegment`) →
  one `@switch` block rendering only the matching section's existing grid
  (booster card / loot-box cards / avatar cards) — same `app-shop-item-card`
  instances used on desktop, just one section visible at a time

### 1e — Locker mobile

Today `AvatarLockerComponent` renders the avatar portrait + locker rows, and
`AvatarsPageComponent` renders `<app-avatar-locker>` then a separate borders
grid below it. The mockup's Avatars/Borders toggle needs to switch between
those two, so the toggle lives in `AvatarsPageComponent` (the parent that
already holds both `avatars` and `borders` data):

`avatars-page.component.ts`:
- New field: `activeView: 'avatars' | 'borders' = 'avatars'` (mobile-only)
- Mobile markup: compact header (equipped avatar thumb + name + equipped
  border swatch, pulled from existing `avatars`/`borders` arrays) →
  Avatars/Borders segmented toggle → `@if (activeView === 'avatars')` renders
  `<app-avatar-locker>` in a mobile mode, else renders the existing border grid

`avatar-locker.component.ts`:
- New `@Input() compact = false` — when true, renders a mobile block: skips the
  portrait pane, shows category chips for each `GROUPS` label present, and lays
  out `.locker` items in a 3-col grid instead of `flex-wrap` rows
- New field: `activeGroup: string | null = null` for the category chips
  (`null` = all groups)

## Testing

- Existing component spec files get new test cases for the mobile-only getters/
  filters (`mobileFiltered()`, segment switching, `compact` input rendering) —
  same pattern as `stats-panel.component.spec.ts`
- No visual/e2e testing in this pass (matches how the 900px tablet tweak was
  never covered by tests either); manual check in Chrome DevTools device mode
  at 390px (iPhone) per the mockup frame width

## Open questions resolved during design

- Shop already exists with a full coin economy (`ShopCatalog`, `ShopController`,
  `ShopService`) — initial assumption that it was speculative was wrong
- Full mockup fidelity chosen over a plain CSS reflow, per user preference
