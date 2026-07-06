# Nav Bar Redesign Design

## Problem

`app.component.ts` (the app shell: desktop sidebar + mobile bottom-nav) still uses the
app's original light-mode visual language — `border-radius` pills, a plain blue gradient
active state, and a flat rounded XP widget/LOG ACTIVITY button. Several other pages
(dashboard, shop, achievements, avatars, leaderboard, profile) have since been redesigned
around a "game HUD" visual identity: angular beveled clip-path corners instead of rounded
corners, colored glow (`box-shadow`) instead of flat fills, and Chakra Petch-driven bold
letter-spaced labels. The nav bar — visible on every page — now reads as a leftover from
before the redesign.

## Goal

Bring `app.component.ts` into the same visual language as the rest of the redesigned app,
without changing its layout, its light background, or its information architecture (same
links, same order, same behavior). This is a shape/accent-language pass, not a
restructuring.

## Scope

In scope — everything currently styled with `border-radius` in `app.component.ts`:
- Desktop sidebar nav items (`.nav-item`, `.nav-item.active`)
- XP widget (`.xp-widget`)
- LOG ACTIVITY button (`.log-btn`)
- Mobile bottom-nav items (`.bottom-nav-item`, `.bottom-nav-item.active`) and the
  floating "+" FAB (`.bottom-fab`)
- The sign-out button (`.signout-btn`) added by a separate, already-in-flight change —
  included for consistency since it lives in the same nav shell, but is a small,
  low-risk treatment (see Non-Goals).

Out of scope:
- The sidebar's white background, overall layout, width, or logo treatment stay as-is.
- No changes to `styles.scss` (a separate in-flight session has unrelated changes there;
  this redesign stays entirely inside `app.component.ts`'s own `styles` array, matching
  how `dashboard.component.ts`/`shop.component.ts`/etc. each own their styles).
- No changes to routing, navigation behavior, or the sign-out confirmation flow.
- No new shared SCSS/TS file for the clip-path primitives. The existing codebase
  convention is: each component defines its own local copy of shared visual primitives
  (e.g. `.bevel`/`.fx` clip-path rules are already duplicated, not shared, between
  `dashboard.component.ts` and `shop.component.ts`). This redesign follows that
  established pattern rather than introducing a new shared-styles refactor, which is a
  separate, larger decision outside this task's scope.

## Visual Language Reference

Pulled from `dashboard.component.ts`'s existing `.bevel`/`.fx` primitives, reused here
(not imported — copied, per the Scope section above):

```css
.fx  { filter: drop-shadow(0 14px 26px rgba(16,32,62,.16)); }
.bevel {
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}
.bevel--sm {
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
}
```

The nav's elements are all small/compact (nav items ~44px tall, XP widget ~140px), so
they use a smaller bevel cut than the dashboard's large cards — an ~8-10px cut corner
(top-left + bottom-right), scaled down from `.bevel--sm`'s 12px.

Lime-green glow accent (used throughout the redesign for "active/positive" states,
e.g. `chip-ic.points`, `log-btn`'s existing box-shadow):
```css
box-shadow: 0 0 14px rgba(198,230,59,.45);
```

## Design

### 1. Desktop nav items (`.nav-item`)

- Replace `border-radius: 12px` with a clip-path bevel (top-left + bottom-right corners
  cut, ~8px), applied to both the resting and active states.
- **Resting state:** unchanged colors (grey text `#5c6881`, transparent background,
  light-grey hover fill `#F4F6FB`) — only the corner shape changes.
- **Active state:** keep the existing blue gradient fill
  (`linear-gradient(150deg,#2E6BE6,#1B47AE)`) — this is the app's core identity color
  and isn't being replaced. Add a soft lime-green glow around the active pill
  (`box-shadow: 0 0 14px rgba(198,230,59,.45)`, layered alongside the existing blue
  drop-shadow, not replacing it) so the active item reads as "lit up" the way the
  dashboard's hero/vault cards glow, rather than just being a flat color block.

### 2. XP widget (`.xp-widget`)

- Replace `border-radius: 16px` with the bevel clip-path (~10px cut, matching the
  widget's larger size relative to nav items).
- Keep the existing lime radial-gradient background and border exactly as-is — only the
  corner shape changes.

### 3. LOG ACTIVITY button (`.log-btn`)

- Replace `border-radius: 14px` with the bevel clip-path (~10px cut).
- Keep the existing lime gradient fill and box-shadow glow exactly as-is (it already
  uses the right color language) — only the corner shape changes. Note: clip-path
  clips box-shadow on the element itself, so if the existing glow disappears visually
  once clip-path is applied, wrap the button in a drop-shadow (`filter: drop-shadow(...)`)
  parent the way `dashboard.component.ts`'s `.fx` wrapper class does, converting the
  `box-shadow` glow to an equivalent `filter: drop-shadow(...)` value.

### 4. Mobile bottom-nav (`.bottom-nav-item`, `.bottom-fab`)

- `.bottom-fab` (the floating "+" button): replace `border-radius: 16px` with a bevel
  clip-path (~8px cut, given its small 52px size).
- `.bottom-nav-item.active`: currently just a color change (`color: #2E6BE6`). Add a
  small lime-green glow/underline accent beneath the active icon+label (e.g. a 2-3px
  lime bar with a subtle glow, positioned under the item) so the active state reads
  consistently with the desktop sidebar's glow treatment, without needing a background
  shape change (bottom-nav items are icon+label stacks, not pill buttons, so a full
  bevel background doesn't apply the same way).

### 5. Sign-out button (`.signout-btn`)

- Low-risk, included for shell consistency: no shape change needed (it's already a
  plain transparent text button with no border-radius to replace). Leave as-is. Called
  out here only so the implementer doesn't wonder why it was skipped.

## Non-Goals

- No dark-mode/dark-panel sidebar (explicitly rejected during design discussion in favor
  of keeping the light background and only changing shape/accent language).
- No changes to the XP widget's or LOG ACTIVITY button's colors, gradients, or copy —
  shape only.
- No new shared/extracted CSS file — duplication of the bevel primitive into
  `app.component.ts`'s own `styles` array is intentional, matching existing codebase
  convention.

## Testing / Verification

This is a pure CSS/template visual change with no new application logic, state, or
data flow — there is nothing here to unit-test. Verification is manual:
- `ng serve`, visually confirm the desktop sidebar's active nav item shows the bevel
  shape + blue fill + lime glow, and inactive items show the bevel shape at rest.
- Confirm the XP widget and LOG ACTIVITY button keep their existing colors but with the
  new corner shape (and that LOG ACTIVITY's glow is still visible, not clipped away).
- Resize to mobile width, confirm the bottom-nav FAB shows the bevel shape and the
  active bottom-nav item shows the lime accent under it.
- Click through all nav links to confirm routing/active-state detection still works
  exactly as before (no `routerLinkActive` logic changes).
