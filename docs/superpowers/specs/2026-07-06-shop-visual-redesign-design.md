# Shop Visual Redesign — Design

Status: approved
Date: 2026-07-06

## Purpose

The Shop page (`frontend/src/app/shop/shop.component.ts`) currently looks like
a generic e-commerce grid — flat white cards on a plain background, no HUD,
no hero moment, no rarity theming. Every other major page in the app
(Achievements/Trophy Track especially) has a "game world" visual identity:
dark HUD bars, a gradient hero spotlight with an animated holographic sweep,
and rarity-coded gradient card frames. This redesign ports that exact visual
language onto the Shop page — reusing, not reinventing, so a "legendary"
shop avatar and a "legendary" achievement literally share the same gold
gradient frame.

## Scope

- Visual/structural redesign of `shop.component.ts` only. No changes to
  `ShopCatalog`/`ShopAvatar` models, `ApiService`, or any backend code —
  this is presentation-layer only, reusing the existing catalog data exactly
  as already fetched.
- No new purchase flows, no new item types, no new API calls.
- Explicitly out of scope: applying this same treatment retroactively to
  other pages, or introducing a shared "themed page shell" component (the
  Achievements page's styles stay where they are; this task copies the
  relevant CSS values into `shop.component.ts`, following this codebase's
  existing convention of each page component owning its own inline styles
  rather than a shared design-system layer).

## Reference source

All values below are copied from `frontend/src/app/achievements/achievements.component.ts`
(the `.panel`/`.hud`/`.spotlight`/`.section-header`/`.feats-grid` block,
roughly lines 246–361) and its `TIER_META` record (lines 77–102). The Shop
redesign is a direct visual port, not a new design — where a value isn't
explicitly called out below, use the achievements page's value verbatim.

## Page shell

Wrap the whole page in the same structure Achievements uses:

- `.page` outer wrapper (padding, `max-width:1240px`, `Nunito` font stack —
  copy verbatim).
- `.panel` — the rounded `#EEF3FB` container (`border-radius:26px`,
  `border:1px solid #dbe4f2`, drop shadow) that holds the HUD bar + content.
- `.hud` — the dark gradient top bar (`linear-gradient(120deg,#12245090,#0e1a34 70%)`
  + radial highlight, copied verbatim). Left side: a `.hud-star`-style icon
  tile (reuse the same lime gradient square, but with the `coin` icon
  instead of the star SVG) next to a title block — `.hud-title` = "SHOP",
  `.hud-sub` = a one-line tagline (e.g. "Spend coins earned from every
  activity you log"). Right side: `.hud-count`-style pill showing the coin
  balance — reuse `.hud-count`/`.hud-count-n` classes verbatim, coin icon +
  `{{ catalog.coins | number }}` in the lime `#C6E63B` count color, no
  "total" suffix needed (drop `.hud-count-total`, this pill has only one
  number, not a "X / Y" ratio).
- `.content` — the padded body area below the HUD (copy verbatim), holding
  the spotlight banner and the three item sections in document order:
  Booster, Loot Boxes, Avatars.

## Hero spotlight banner

Reuse `.spotlight`/`.spotlight-sweep`/`.spotlight-art`/`.spotlight-body`
verbatim (blue gradient `linear-gradient(135deg,#2E6BE6,#173B92)`, animated
holographic sweep, two-column grid with art on the left).

Always features the **Special Loot Box** (static, not rotating — it's the
shop's premium item and this keeps the feature simple):

- `.spotlight-chip` (lime pill, currently reads e.g. "NEWLY UNLOCKED" on
  Achievements) → relabel to `"FEATURED"`.
- `.spotlight-tier` (small caps line above the name) → `"SPECIAL LOOT BOX"`.
- `.spotlight-name` (the big 38px name) → the odds summary, e.g.
  `"30% · 45% · 25%"` is too terse for a hero moment — instead put a short
  punchy line here like `"Better Odds, Guaranteed"` (static copy, not
  data-driven) and move the actual odds numbers to `.spotlight-desc`.
- `.spotlight-desc` → `"{{ special.commonPct }}% common · {{ special.rarePct }}% rare · {{ special.legendaryPct }}% legendary — the same reward pool, better odds."`
- `.spotlight-meta` / `.spotlight-xp` (the lime pill CTA button on
  Achievements, currently just a static XP-reward display) → becomes an
  actual clickable button here: `<button class="spotlight-xp" (click)="buyLootBox('special')" [disabled]="buying || catalog.coins < special.price">BUY — {{ special.price }} <app-icon name="coin"/></button>`.
  Reuse the exact `.spotlight-xp` visual styling (lime background, dark
  text, rounded, shadow) since it already reads as a strong CTA; just make
  it an interactive `<button>` instead of a `<div>`.
- `.spotlight-art` — no item image exists for a loot box (loot boxes aren't
  avatars with an `imagePath`), so this slot shows the existing `package`
  icon from `ICONS` (`frontend/src/app/shared/constants/icons.constants.ts`
  — already used for the loot-box HUD tile on the dashboard) via
  `<app-icon name="package">`, rendered large (e.g. `[size]="96"`) and
  centered on a dark translucent circular backing, rather than an `<img>`.

## Section styling

Reuse `.section`/`.section-header`/`.section-title`/`.section-count`
verbatim for all three sections' headers: "XP BOOSTER" (count omitted,
there's only one item), "LOOT BOXES" (`.section-count` shows "2"), "AVATARS"
(`.section-count` shows "6"). Reuse `.feats-grid` verbatim as the card grid
container for all three sections (replaces the current plain `.cards` grid).

## Card treatments

**Shared card chrome** — every card in all three sections uses the same
frame structure as `AchievementCardComponent`'s `.card`/`.holo`/`.inner`
(rounded outer frame with a colored gradient background showing through a
3px padding border, holographic sweep overlay, white inner content area).
This is enough shared structure to justify extracting a small reusable
presentational component rather than copy-pasting the frame markup three
times — see "New component" below.

**Rarity-to-frame mapping** — reuse `TIER_META`'s gradient/shadow/label-color
values directly, keyed by rarity string instead of achievement tier:

| Shop rarity / category | Reused `TIER_META` key | Frame gradient |
|---|---|---|
| Avatar `rarity: "common"` | `bronze` | `linear-gradient(160deg,#F5D3A3,#CD7F32 55%,#8A4F16)` |
| Avatar `rarity: "rare"` | `silver` | `linear-gradient(160deg,#F2F5FA,#C6CFDE 55%,#93A1B7)` |
| Avatar `rarity: "legendary"` | `gold` | `linear-gradient(160deg,#FDE9A7,#F5B300 50%,#B57C00)` |
| Loot box `tier: "normal"` | `bronze` | same as common avatars — the base-odds box |
| Loot box `tier: "special"` | `gold` | same as legendary avatars — the skewed-odds box |
| XP Booster (no rarity) | — new, see below | — |

The rarity *label* shown in the corner badge (`.rarity` pill on
`AchievementCardComponent`, showing "COMMON"/"RARE"/"LEGENDARY") is reused
verbatim for avatars and loot boxes — for loot boxes it reads "COMMON" /
"LEGENDARY" respectively (standing in for "this is the base-tier box" /
"this is the premium box"), which is honest shorthand since those are
literally the odds each tier is skewed toward.

**XP Booster's distinct frame** — since it isn't rarity-tiered, it gets its
own gradient, visually related to but distinct from the rarity set, so it
doesn't look like a mis-tagged rarity item: `linear-gradient(160deg,#C6E63B,#9ECF10)`
(the same lime gradient already used for `.hud-star` and XP-related UI
elsewhere in the app), with a `lightning` icon (already in `ICONS`) in the
corner chip instead of the star/checkmark glyph, and a "POWER-UP" label in
the corner pill instead of a rarity word.

**Owned / affordability states** — mirrors `AchievementCardComponent`'s
locked/unlocked treatment exactly:
- **Owned avatar:** render like an *unlocked* achievement card — full-color
  frame, no grayscale filter on the art, a lime checkmark badge in place of
  the buy button (reuse `.unlocked-tag`/`.check` styling), no price shown.
- **Affordable, not owned:** full-color frame, lime "BUY — {{ price }}"
  button (styled like the existing `.buy-btn` but recolored to the lime
  accent `#C6E63B` background / dark text, matching the app's primary CTA
  color rather than the current blue).
- **Not affordable:** render like a *locked* achievement card — frame
  swapped to `LOCKED_FRAME` (`linear-gradient(160deg,#e3e9f2,#c1ccdb)`), art
  grayscaled (`filter:grayscale(1) brightness(1.1) opacity(.45)` reused
  verbatim for avatar images only — loot box/booster cards have no `<img>`
  so this only affects the Avatars section), buy button disabled and
  reused `.locked-tag` styling in place of the price line (e.g. "🔒 Need
  {{ price - catalog.coins }} more coins").

## New component

Given the shared card-frame structure (holo sweep, tier-chip, rarity badge,
locked/unlocked states) is now used across three visually-similar-but-
data-different card kinds (booster/loot-box/avatar), extract a small
presentational `ShopItemCardComponent` (`frontend/src/app/shop/shop-item-card.component.ts`)
that takes generic `@Input()`s (`name`, `description`, `imagePath: string | null`,
`frameGradient`, `frameShadow`, `badgeLabel`, `badgeColor`, `badgeBg`,
`price`, `owned: boolean`, `affordable: boolean`, `buying: boolean`) and one
`@Output() buy = new EventEmitter<void>()`. `ShopComponent` computes the
rarity→frame/badge mapping (a small lookup object mirroring `TIER_META`,
scoped to this component) and passes the resolved values down, keeping the
card's internal template/CSS in one focused file rather than duplicating
the frame markup three times in `ShopComponent`'s own template. This
mirrors the existing `AchievementCardComponent` pattern (a dumb, reusable
card driven by inputs, owned by the parent page for data/state).

## Testing

- No backend changes, so no new backend tests.
- Manual/visual verification only (this repo has no frontend test runner in
  active use and no Playwright/e2e config, consistent with how prior
  frontend-only tasks in this codebase were verified): `ng build` for a
  clean compile, then a manual pass in the browser confirming: HUD coin
  balance renders, spotlight always shows the Special Loot Box and its
  BUY button purchases correctly, each section's cards show the correct
  rarity/power-up frame and correct owned/affordable/locked state, and an
  avatar purchase transitions its card from "affordable" to "owned" live
  after `this.load()` refetches the catalog.

## Out of scope

- No shared cross-page "themed shell" component — each page continues to
  own its inline styles, consistent with the rest of this codebase.
- No rotating/dynamic featured item — the spotlight always shows the
  Special Loot Box.
- No changes to the underlying purchase logic, error handling, or API
  surface — this is a template/CSS-level redesign plus one new small
  presentational component.
