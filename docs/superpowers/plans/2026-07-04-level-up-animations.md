# Level-Up Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated XP bar (two distinct animations for boot-up vs. XP gain) and a level-up burst (hero glow + badge pop + expanding ring + count-up) to the dashboard hero card.

**Architecture:** All changes are confined to a single Angular component (`dashboard.component.ts`). Six new state fields drive CSS class bindings; CSS `@keyframes` handle all visual effects; a `triggerLevelUp()` method orchestrates the burst via `setInterval` + `setTimeout`. No new files, no new dependencies.

**Tech Stack:** Angular 17 standalone components, inline CSS `@keyframes`, TypeScript.

## Global Constraints

- Angular 17 standalone component — no NgModules, no `@angular/animations`
- All CSS lives in the component's `styles: []` array — no external stylesheet
- No new npm dependencies
- Template uses mixed `*ngIf` / `@if` as already present — do not convert existing directives
- Do not commit automatically — user handles all git commits

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/src/app/dashboard/dashboard.component.ts` |

---

### Task 1: Animated XP Bar (boot-up + XP gain)

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**What this delivers:** The XP bar fills from 0 on every page load (slow ease-out, "power-up" feel). On subsequent reloads after activity logging, it extends to the new value faster with a white flash overlay. No level-up burst yet — that's Task 2.

**Interfaces:**
- Produces: fields `displayedXpPercent: number`, `isBootUp: boolean`, `xpFlashActive: boolean` — Task 2 reads these

---

- [ ] **Step 1: Add three new state fields to the component class**

Open `frontend/src/app/dashboard/dashboard.component.ts`. In the class body, after the existing `pendingBoxes = 0;` line (around line 348), add:

```typescript
displayedXpPercent = 0;
isBootUp = true;
xpFlashActive = false;
```

- [ ] **Step 2: Update the XP bar template**

In the template, find the existing XP bar block (around line 224):

```html
<div class="xp-bar">
  <div class="xp-fill" [style.width.%]="xpPercent"></div>
</div>
```

Replace it with:

```html
<div class="xp-bar">
  <div class="xp-fill"
       [class.xp-fill--boot]="isBootUp"
       [class.xp-fill--gain]="!isBootUp"
       [style.width.%]="displayedXpPercent"></div>
  <div class="xp-flash"
       [class.xp-flash--active]="xpFlashActive"
       (animationend)="xpFlashActive = false"></div>
</div>
```

- [ ] **Step 3: Update `.xp-bar` CSS and add new animation CSS**

In the `styles: []` array, find the existing `.xp-bar` rule:

```css
.xp-bar { height: 12px; border-radius: 999px; background: rgba(0,0,0,.24); max-width: 62%; overflow: hidden; }
```

Replace it with (adds `position: relative` so the flash overlay can use `position: absolute`):

```css
.xp-bar { height: 12px; border-radius: 999px; background: rgba(0,0,0,.24); max-width: 62%; overflow: hidden; position: relative; }
```

Then add these new rules immediately after `.xp-fill { ... }`:

```css
.xp-fill--boot { transition: width 1.3s cubic-bezier(0.15, 0.9, 0.3, 1); }
.xp-fill--gain { transition: width 0.7s ease-in-out; }
.xp-flash {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.7); opacity: 0; pointer-events: none;
}
@keyframes xpFlash { 0% { opacity: 0; } 30% { opacity: 0.6; } 100% { opacity: 0; } }
.xp-flash--active { animation: xpFlash 400ms ease-out forwards; }
```

- [ ] **Step 4: Update `loadData()` to drive the animations**

Find the `loadData()` method. Its `next:` handler currently starts with:

```typescript
next: data => {
  this.data = data;
  this.loadPendingBoxes(uid);
  if (data.xp) {
    this.userState.setXp(data.xp);
  }
  this.weeklyPoints = data.pointsOverTime
    .filter(p => new Date(p.date) >= new Date(Date.now() - 7 * 86400000))
    .reduce((s, p) => s + p.points, 0);
  this.loading = false;
  this.loadLeaderboard(uid);
},
```

Replace the entire `next:` handler body with:

```typescript
next: data => {
  const bootUp = this.isBootUp;
  this.data = data;
  this.loadPendingBoxes(uid);
  if (data.xp) {
    this.userState.setXp(data.xp);
  }
  this.weeklyPoints = data.pointsOverTime
    .filter(p => new Date(p.date) >= new Date(Date.now() - 7 * 86400000))
    .reduce((s, p) => s + p.points, 0);
  this.loading = false;
  this.loadLeaderboard(uid);

  if (bootUp) {
    // Render at 0 first, then animate to target (boot-up sweep)
    setTimeout(() => {
      this.displayedXpPercent = this.xpPercent;
      this.isBootUp = false;
    }, 0);
  } else {
    // XP gain: flash + fast fill
    this.xpFlashActive = true;
    this.displayedXpPercent = this.xpPercent;
  }
},
```

- [ ] **Step 5: Verify the build compiles**

```bash
cd frontend && ng build --configuration=production 2>&1 | tail -20
```

Expected: output ending with `✔ Browser application bundle generation complete.` and no TypeScript errors.

- [ ] **Step 6: Manual visual verification — boot-up animation**

Start the dev server if not already running:
```bash
cd frontend && ng serve
```

Open the app in the browser at `http://localhost:4200`. Navigate to the dashboard.

Check:
- On page load, the XP bar sweeps from left to right over ~1.3 seconds with a decelerating ease (slow at the end).
- No console errors.

- [ ] **Step 7: Manual visual verification — XP gain animation**

Log an activity (click "+ LOG ACTIVITY", fill in a form, submit). After the dialog closes the dashboard reloads.

Check:
- The XP bar extends to the new width over ~0.7 seconds (faster than boot-up).
- A brief white flash appears on the bar then fades (visible for ~400ms).
- No console errors.

---

### Task 2: Level-Up Burst (hero glow + badge pop + ring + count-up)

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**What this delivers:** When a logged activity pushes the player to a new level, the hero card pulses green, the level badge pops and the number ticks up, and a ring expands out from the badge. All effects auto-dismiss after 2 seconds.

**Interfaces:**
- Consumes: `displayedXpPercent`, `isBootUp`, `xpFlashActive` from Task 1
- Produces: nothing (terminal task)

---

- [ ] **Step 1: Add three more state fields**

In the class body, directly after the three fields added in Task 1 (`displayedXpPercent`, `isBootUp`, `xpFlashActive`), add:

```typescript
prevLevel = 0;
levelUpActive = false;
displayedLevel = 1;
```

- [ ] **Step 2: Add `triggerLevelUp()` private method**

Add this method to the class, below `ngOnDestroy()`:

```typescript
private triggerLevelUp(fromLevel: number, toLevel: number): void {
  this.levelUpActive = true;
  this.xpFlashActive = true;
  this.displayedLevel = fromLevel;

  const steps = toLevel - fromLevel;
  let step = 0;
  const ticker = setInterval(() => {
    step++;
    this.displayedLevel = fromLevel + step;
    if (step >= steps) clearInterval(ticker);
  }, 80);

  setTimeout(() => { this.levelUpActive = false; }, 2000);
}
```

- [ ] **Step 3: Update `loadData()` to track level and trigger burst**

Find the `if (bootUp) { ... } else { ... }` block added in Task 1:

```typescript
if (bootUp) {
  // Render at 0 first, then animate to target (boot-up sweep)
  setTimeout(() => {
    this.displayedXpPercent = this.xpPercent;
    this.isBootUp = false;
  }, 0);
} else {
  // XP gain: flash + fast fill
  this.xpFlashActive = true;
  this.displayedXpPercent = this.xpPercent;
}
```

Replace it with:

```typescript
if (bootUp) {
  // Sync level display and snapshot on first load — no burst
  this.displayedLevel = this.level;
  this.prevLevel = this.level;
  setTimeout(() => {
    this.displayedXpPercent = this.xpPercent;
    this.isBootUp = false;
  }, 0);
} else {
  // Check for level crossing before updating snapshot
  if (this.level > this.prevLevel) {
    this.triggerLevelUp(this.prevLevel, this.level);
  } else {
    this.xpFlashActive = true;
  }
  this.displayedXpPercent = this.xpPercent;
  this.prevLevel = this.level;
}
```

- [ ] **Step 4: Update the level badge template**

Find the existing level badge (around line 217):

```html
<div class="level-badge">⚡ LEVEL {{ level }} · {{ levelTitle }}</div>
```

Replace with:

```html
<div class="level-badge" [class.level-badge--pop]="levelUpActive">
  ⚡ LEVEL {{ displayedLevel }} · {{ levelTitle }}
</div>
```

- [ ] **Step 5: Update the hero card and add the ring element**

Find the hero card opening tag (around line 211):

```html
<div class="hero-card">
```

Replace with:

```html
<div class="hero-card" [class.hero-card--glow]="levelUpActive">
  <div class="level-ring" [class.level-ring--active]="levelUpActive"></div>
```

Make sure the `</div>` closing the hero card is still in place — you are only adding two lines at the top of the card's content, not restructuring anything.

- [ ] **Step 6: Add burst CSS**

In `styles: []`, after the existing `@keyframes glowpulse { ... }` block, add:

```css
@keyframes heroGlow {
  0%, 100% { box-shadow: 0 20px 40px -18px rgba(30,79,184,.7); }
  50%       { box-shadow: 0 20px 40px -18px rgba(30,79,184,.7), 0 0 60px rgba(198,230,59,.55); }
}
.hero-card--glow { animation: heroGlow 1s ease-in-out 2; }

@keyframes levelBadgePop {
  0%   { transform: scale(1);   background: rgba(255,255,255,.14); color: #C6E63B; }
  25%  { transform: scale(1.5); background: rgba(198,230,59,.9);   color: #0f1e3b; }
  65%  { transform: scale(1.1); }
  100% { transform: scale(1);   background: rgba(255,255,255,.14); color: #C6E63B; }
}
.level-badge--pop { animation: levelBadgePop 600ms ease-out forwards; }

.level-ring {
  position: absolute; top: 10px; left: 18px;
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid #C6E63B; opacity: 0; pointer-events: none;
}
@keyframes ringExpand {
  0%   { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(3);   opacity: 0; }
}
.level-ring--active { animation: ringExpand 700ms ease-out forwards; }
```

- [ ] **Step 7: Verify the build compiles**

```bash
cd frontend && ng build --configuration=production 2>&1 | tail -20
```

Expected: `✔ Browser application bundle generation complete.` with no TypeScript errors.

- [ ] **Step 8: Manual visual verification — normal flow (no level-up)**

Reload the dashboard. Log an activity that does NOT push the player to a new level.

Check:
- XP bar flashes and extends (Task 1 behavior intact).
- Level badge does NOT pop, hero card does NOT glow, ring does NOT appear.
- `displayedLevel` shows the correct level number (same as before).
- No console errors.

- [ ] **Step 9: Manual visual verification — level-up burst**

To force a level-up: temporarily note the player's current XP total and target a sport that will push them over the next level threshold. (Levels use 200-XP bands; running 2 km = 200 points. If unsure, log a large Daily Steps count e.g. 50000 steps = 500 XP.)

After logging:
- Hero card box-shadow pulses bright green twice (~2 seconds total).
- Level badge scales up to 1.5× and background flips lime-green for ~150ms, then bounces back.
- A green ring expands outward from the badge and fades.
- The level number in the badge ticks from the old value to the new value.
- XP bar simultaneously flashes and extends.
- All effects stop after ~2 seconds.
- No console errors.

---

## Notes for Implementer

- **`this.level` is a getter** — it reads from `this.data?.xp?.level ?? 1`. It is only valid after `this.data = data` is set in `loadData()`. Never read it before that line.
- **`isBootUp` starts `true`** — the very first call to `loadData()` uses the boot-up path; every subsequent call (triggered by `activityLogged$` subscription or loot-box modal close) uses the gain path.
- **`hero-card` already has `position: relative`** — the `.level-ring` uses `position: absolute`, which works because `.hero-card` already sets `position: relative` in the existing CSS (line ~61).
- **Do not change `*ngIf` to `@if`** — the template mixes both syntaxes; leave existing directives as-is.
