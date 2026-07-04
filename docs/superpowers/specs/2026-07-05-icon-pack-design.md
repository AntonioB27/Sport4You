# Icon Pack — Design Spec
**Date:** 2026-07-05
**Phase:** 7 (Polish)

---

## Overview

Replace all emoji characters in the Angular frontend with inline SVG icons from **Phosphor Icons** (bold weight, 256×256 viewBox, `currentColor` stroke). Pure decorative ASCII marks (`✦`, `✓`, `✕`) are left unchanged. Celebratory emoji in button labels (`👋`, `🎉`, `🏅`, `🎭`, `🏃`) are removed — the text labels stand alone.

No backend changes. No new npm dependencies. All icon SVG strings live in a single constants file and render through a tiny shared component.

---

## Section 1: Icon Source

**Set:** Phosphor Icons, Bold weight  
**License:** MIT  
**Source:** https://github.com/phosphor-icons/core — SVG files live in `assets/bold/` in the repo. Each file is a 256×256 viewBox SVG with `fill="currentColor"` and a single `<path>` element.

**How to get a path:** Open `assets/bold/<name>-bold.svg` from the Phosphor core repo and copy the `<path d="..."/>` element. Wrap it in:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256"><path d="..."/></svg>
```

**Icons needed (Phosphor name → bold file):**

| Alias used in app | Phosphor filename |
|-------------------|-------------------|
| `house` | `house-bold.svg` |
| `trophy` | `trophy-bold.svg` |
| `medal` | `medal-bold.svg` |
| `user` | `user-bold.svg` |
| `crown` | `crown-bold.svg` |
| `flame` | `flame-bold.svg` |
| `coin` | `coin-bold.svg` |
| `package` | `package-bold.svg` |
| `lightning` | `lightning-bold.svg` |
| `star` | `star-bold.svg` |
| `person-run` | `person-simple-run-bold.svg` |
| `person-walk` | `person-simple-walk-bold.svg` |
| `bicycle` | `bicycle-bold.svg` |
| `waves` | `waves-bold.svg` |
| `barbell` | `barbell-bold.svg` |
| `sneaker` | `sneaker-move-bold.svg` |

---

## Section 2: New File — `icons.constants.ts`

**Path:** `frontend/src/app/shared/constants/icons.constants.ts`

Exports a single `ICONS` record mapping the alias strings above to their full SVG strings.

```typescript
export const ICONS: Record<string, string> = {
  house:        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256"><path d="..."/></svg>`,
  trophy:       `<svg ...>...</svg>`,
  medal:        `<svg ...>...</svg>`,
  user:         `<svg ...>...</svg>`,
  crown:        `<svg ...>...</svg>`,
  flame:        `<svg ...>...</svg>`,
  coin:         `<svg ...>...</svg>`,
  package:      `<svg ...>...</svg>`,
  lightning:    `<svg ...>...</svg>`,
  star:         `<svg ...>...</svg>`,
  'person-run': `<svg ...>...</svg>`,
  'person-walk':`<svg ...>...</svg>`,
  bicycle:      `<svg ...>...</svg>`,
  waves:        `<svg ...>...</svg>`,
  barbell:      `<svg ...>...</svg>`,
  sneaker:      `<svg ...>...</svg>`,
};
```

The implementer must copy the actual `<path d="..."/>` values from the Phosphor core repository for each icon before filling in the template above.

---

## Section 3: New File — `icon.component.ts`

**Path:** `frontend/src/app/shared/components/icon/icon.component.ts`

A tiny standalone Angular component. Takes a `name` input (key into `ICONS`) and an optional `size` input (defaults to `"20"`). Renders the SVG string via `[innerHTML]`.

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICONS } from '../../constants/icons.constants';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; }`],
  template: `<span [innerHTML]="svg" [style.width.px]="size" [style.height.px]="size" style="display:inline-flex;align-items:center;"></span>`,
})
export class IconComponent {
  @Input({ required: true }) name = '';
  @Input() size: number = 20;
  get svg(): string { return ICONS[this.name] ?? ''; }
}
```

The `size` input scales the host element's layout box. The SVG itself is 24×24 in the markup but inherits `currentColor` so it renders at whatever CSS `color` the parent sets.

---

## Section 4: Updated File — `sport.constants.ts`

**Path:** `frontend/src/app/shared/constants/sport.constants.ts`

Remove the `SPORT_ICONS` emoji map. Sport activity icons in the dashboard are now rendered via `<app-icon>` using the mapping below.

Replace the `SPORT_ICONS` export with:

```typescript
export const SPORT_ICON_NAMES: Record<string, string> = {
  running:     'person-run',
  walking:     'person-walk',
  cycling:     'bicycle',
  swimming:    'waves',
  gym:         'barbell',
  daily_steps: 'sneaker',
};
```

Any callers of the old `sportIcon()` method in `dashboard.component.ts` are updated to use `SPORT_ICON_NAMES[sport] ?? 'medal'` and render `<app-icon [name]="sportIconName(a.sport)" />` in the template.

---

## Section 5: Emoji → Icon Replacement Map (per file)

### `app.component.ts` — navigation

| Before | After |
|--------|-------|
| `<span class="icon">🏠</span> Home` | `<app-icon name="house" [size]="18" /> Home` |
| `<span class="icon">🏆</span> Leaderboard` | `<app-icon name="trophy" [size]="18" /> Leaderboard` |
| `<span class="icon">🏅</span> BADGES` | `<app-icon name="medal" [size]="18" /> BADGES` |
| `<span class="icon">👤</span> PROFILE` | `<app-icon name="user" [size]="18" /> PROFILE` |

Same replacements in the mobile bottom nav. Add `IconComponent` to the `imports` array.

### `dashboard.component.ts`

| Before | After |
|--------|-------|
| `👋` in welcome name | removed — "Hi, {{ name }}" |
| `🔥 {{ streak }}` in streak badge | `<app-icon name="flame" [size]="16" /> {{ streak }}` |
| `🪙 {{ points }}` in coins badge | `<app-icon name="coin" [size]="16" /> {{ points }}` |
| `📦 {{ pendingBoxes }}` in box badge | `<app-icon name="package" [size]="16" /> {{ pendingBoxes }}` |
| `⚡ LEVEL` in level badge | `<app-icon name="lightning" [size]="14" />  LEVEL` |
| `{{ data.activities.length }} 🎖️` | `{{ data.activities.length }} <app-icon name="medal" [size]="18" />` |
| `🏆 LEADERBOARD` card title | `<app-icon name="trophy" [size]="18" /> LEADERBOARD` |
| `🏅 RECENT ACHIEVEMENTS` | `<app-icon name="medal" [size]="18" /> RECENT ACHIEVEMENTS` |
| `tierIcon()` returns `'⭐'` / `'🏆'` / `'🔥'` | returns `'star'` / `'trophy'` / `'flame'` — render as `<app-icon [name]="tierIcon(m.tier)" [size]="20" />` |
| Sport activity icon: `{{ sportIcon(a.sport) }}` in `.activity-icon` | `<app-icon [name]="sportIconName(a.sport)" [size]="20" />` |

`tierIcon()` renamed to keep signature; return type changes from string emoji to icon name string.  
Add new method `sportIconName(sport: string): string { return SPORT_ICON_NAMES[sport] ?? 'medal'; }`.  
Remove `sportIcon()` method and its `SPORT_ICONS` import.  
Add `IconComponent` to imports.

### `leaderboard.component.ts`

| Before | After |
|--------|-------|
| `🏆 LEADERBOARD` header | `<app-icon name="trophy" [size]="22" /> LEADERBOARD` |
| `<div style="font-size:34px">👑</div>` (#1 podium) | `<app-icon name="crown" [size]="34" />` |

Add `IconComponent` to imports.

### `achievements.component.ts`

| Before | After |
|--------|-------|
| No emoji replacements needed (only `✦` and `✓` which stay) | — |

No changes to this file.

### `log-activity-dialog.component.ts`

| Before | After |
|--------|-------|
| `DONE 🎉` button text | `DONE` |
| `AWESOME! 🏅` button text | `AWESOME!` |
| `NICE! 🎭` button text | `NICE!` |

No icon import needed — these are just string removals.

### `register-dialog.component.ts`

| Before | After |
|--------|-------|
| `Welcome to Sport4You 🏃` | `Welcome to Sport4You` |
| `Welcome back 👋` | `Welcome back` |

No icon import needed.

---

## Section 6: CSS Adjustments

The existing `.icon` CSS class in `app.component.ts` (used on `<span class="icon">`) currently sizes the emoji. After the change, the `<app-icon>` host element uses `display: inline-flex` so the `.icon` class wrapper span is no longer needed — remove it and the class from nav items.

In `dashboard.component.ts`, `.activity-icon` currently uses `font-size: 16px` to size the emoji. After the change, the `<app-icon [size]="20" />` component controls its own size. Remove `font-size` from `.activity-icon` (the background color and border-radius remain).

In `dashboard.component.ts`, `.quest-icon` also renders emoji at `font-size` inherited. Same treatment — the `<app-icon>` handles its own size; remove `font-size` from `.quest-icon`.

---

## Section 7: Files Changed

| Action | File |
|--------|------|
| Create | `frontend/src/app/shared/constants/icons.constants.ts` |
| Create | `frontend/src/app/shared/components/icon/icon.component.ts` |
| Modify | `frontend/src/app/shared/constants/sport.constants.ts` |
| Modify | `frontend/src/app/app.component.ts` |
| Modify | `frontend/src/app/dashboard/dashboard.component.ts` |
| Modify | `frontend/src/app/leaderboard/leaderboard.component.ts` |
| Modify | `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` |
| Modify | `frontend/src/app/shared/components/register-dialog/register-dialog.component.ts` |

`achievements.component.ts` — no changes needed.
