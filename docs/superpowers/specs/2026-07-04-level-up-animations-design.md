# Level-Up Animations — Design Spec
**Date:** 2026-07-04
**Phase:** 6 (Dashboard Polish)

---

## Overview

Two animation features on the dashboard hero card:

1. **Animated XP bar** — the bar fills visually on every page load (boot-up) and when XP is added mid-session (XP gain). The two situations use distinct animations so the player can feel the difference.
2. **Level-up burst** — when a logged activity pushes the player to a new level, the hero card reacts with a coordinated burst: hero glow, badge pop, expanding ring, and a level number count-up.

---

## Section 1: State Tracking

Six new fields on `DashboardComponent`:

| Field | Type | Purpose |
|-------|------|---------|
| `displayedXpPercent` | `number` | What `[style.width.%]` actually renders. Starts at 0; animated to `xpPercent`. |
| `prevLevel` | `number` | Snapshot of level before each `loadData()`. Used to detect a crossing. |
| `isBootUp` | `boolean` | True only on the very first load. Selects the boot-up CSS transition class. |
| `levelUpActive` | `boolean` | True while the burst is playing. Drives the burst CSS class; auto-reset after 2000ms. |
| `displayedLevel` | `number` | The number shown in the level badge. Ticks from `prevLevel` to `newLevel` via `setInterval`. |
| `xpFlashActive` | `boolean` | True for the duration of the flash overlay animation on XP gain. Reset by `animationend`. |

### Boot-up flow

1. `isBootUp = true`, `displayedXpPercent = 0` (initial field values).
2. `loadData()` fetches dashboard data.
3. On success: `this.data = data`, then `setTimeout(() => { this.displayedXpPercent = this.xpPercent; this.isBootUp = false; }, 0)`.
4. The `setTimeout(0)` lets Angular render the bar at 0 first; the CSS transition then fires for the sweep.

### XP-gain flow (subsequent loads)

1. Before `loadData()`: `this.prevLevel = this.level` (snapshot old level; safe because `level` is a getter from `this.data`).
2. On success: set `this.data = data`, then detect level crossing.
3. If `this.level > this.prevLevel`: trigger burst (see Section 3).
4. Always: `this.displayedXpPercent = this.xpPercent` — CSS gain transition fires.

Note: `isBootUp` is set to `false` after the first load, so all subsequent calls use the gain animation path.

---

## Section 2: XP Bar — Two Distinct Animations

### Template change

Replace:
```html
<div class="xp-fill" [style.width.%]="xpPercent"></div>
```
With:
```html
<div class="xp-bar">
  <div class="xp-fill"
       [class.xp-fill--boot]="isBootUp"
       [class.xp-fill--gain]="!isBootUp"
       [style.width.%]="displayedXpPercent"></div>
  <div class="xp-flash" [class.xp-flash--active]="xpFlashActive" (animationend)="xpFlashActive = false"></div>
</div>
```

`xpFlashActive` is set to `true` on XP gain alongside `displayedXpPercent` update, and reset by the `animationend` event.

### CSS

```css
/* Boot-up: slow power-up sweep */
.xp-fill--boot {
  transition: width 1.3s cubic-bezier(0.15, 0.9, 0.3, 1);
}

/* XP gain: fast punch */
.xp-fill--gain {
  transition: width 0.7s ease-in-out;
}

/* Flash overlay inside .xp-bar */
.xp-flash {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.7); opacity: 0; pointer-events: none;
}
.xp-flash--active {
  animation: xpFlash 400ms ease-out forwards;
}
@keyframes xpFlash {
  0%   { opacity: 0; }
  30%  { opacity: 0.6; }
  100% { opacity: 0; }
}
```

`.xp-bar` needs `position: relative` added (it currently only has `height`, `border-radius`, `background`, `max-width`, `overflow: hidden`).

---

## Section 3: Level-Up Burst

Triggered when `this.level > this.prevLevel` inside `loadData()` success handler.

### Template additions (inside `.hero-card`)

```html
<!-- Expanding ring, anchored over the level badge -->
<div class="level-ring" [class.level-ring--active]="levelUpActive"></div>
```

The `.level-badge` text becomes:
```html
<div class="level-badge" [class.level-badge--pop]="levelUpActive">
  ⚡ LEVEL {{ displayedLevel }} · {{ levelTitle }}
</div>
```

The `.hero-card` div gains `[class.hero-card--glow]="levelUpActive"`.

### CSS

```css
/* Hero card glow */
@keyframes heroGlow {
  0%, 100% { box-shadow: 0 20px 40px -18px rgba(30,79,184,.7); }
  50%       { box-shadow: 0 20px 40px -18px rgba(30,79,184,.7), 0 0 60px rgba(198,230,59,.55); }
}
.hero-card--glow {
  animation: heroGlow 1s ease-in-out 2;
}

/* Level badge pop */
@keyframes levelBadgePop {
  0%   { transform: scale(1);    background: rgba(255,255,255,.14); }
  25%  { transform: scale(1.5);  background: rgba(198,230,59,.9); color: #0f1e3b; }
  65%  { transform: scale(1.1); }
  100% { transform: scale(1);    background: rgba(255,255,255,.14); color: #C6E63B; }
}
.level-badge--pop {
  animation: levelBadgePop 600ms ease-out forwards;
}

/* Expanding ring */
.level-ring {
  position: absolute; top: 10px; left: 18px;
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid #C6E63B; opacity: 0; pointer-events: none;
}
@keyframes ringExpand {
  0%   { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(3);   opacity: 0; }
}
.level-ring--active {
  animation: ringExpand 700ms ease-out forwards;
}
```

### TypeScript — burst trigger

```typescript
private triggerLevelUp(fromLevel: number, toLevel: number): void {
  this.levelUpActive = true;
  this.xpFlashActive = true;
  this.displayedLevel = fromLevel;

  // Count-up tick (80ms per level — always 1 in practice)
  const steps = toLevel - fromLevel;
  let step = 0;
  const ticker = setInterval(() => {
    step++;
    this.displayedLevel = fromLevel + step;
    if (step >= steps) clearInterval(ticker);
  }, 80);

  // Auto-reset burst after 2s
  setTimeout(() => { this.levelUpActive = false; }, 2000);
}
```

Called from `loadData()` success handler:
```typescript
if (this.level > this.prevLevel) {
  this.triggerLevelUp(this.prevLevel, this.level);
}
this.displayedXpPercent = this.xpPercent;
```

---

## Section 4: Files Changed

| Action | File |
|--------|------|
| Modify | `frontend/src/app/dashboard/dashboard.component.ts` |

Only one file changes. All animation logic lives inline in the component (CSS in `styles:[]`, TypeScript in the class).

---

## Section 5: No Backend Changes

This feature is entirely frontend. The backend already returns `data.xp.level`, `data.xp.xpPercent`, `data.xp.xpInLevel`, and `data.xp.xpForNextLevel` on every dashboard response — no new API fields needed.

---

## Section 6: Edge Cases

- **Level-up on first load (impossible in practice):** `prevLevel` is 0 on init; if somehow `level > 0 > prevLevel`, the burst would fire on boot. Guard: only trigger burst if `!isBootUp`.
- **Multiple rapid refreshes:** `levelUpActive` reset is idempotent; a second `setTimeout` just re-schedules the reset. No compounding issue.
- **Level-up on loot-box modal close:** `loadData()` is not called after the loot-box modal closes (only `pendingBoxes` is refreshed). No burst fires — correct, since the loot box doesn't grant XP directly to a level crossing visible in the dashboard flow at that moment.
