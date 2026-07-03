# Unlock Splash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat achievement/avatar unlock overlays in the log-activity dialog with full-bleed art splashes (artwork background, tier wash, staggered text, XP count-up, confetti, gold shimmer).

**Architecture:** All UI lives in `log-activity-dialog.component.ts` (inline styles + template, the repo's established pattern). The icon-path helper moves to a shared util so the dialog doesn't import from a page component. Queue logic is untouched.

**Tech Stack:** Angular 17 standalone components, CSS keyframe animations, `requestAnimationFrame` for the XP ticker.

**Spec:** `docs/superpowers/specs/2026-07-02-unlock-splash-design.md`

## Global Constraints

- **NEVER commit.** Antonio handles all git commits himself. No `git add`/`git commit` steps anywhere.
- No frontend unit-test harness exists in this repo; verification is `npx ng build` (must pass with no new errors) plus the Playwright runtime check in Task 4. Do not add a test framework.
- Match existing code style: inline `styles`/`template`, `s4y-` prefix for keyframes, Chakra Petch/Nunito fonts, `#C6E63B` lime accent.
- Backend must be running on `http://localhost:5262`, frontend dev server on `http://localhost:4200` for Task 4.

---

### Task 1: Shared achievement-icon util

**Files:**
- Create: `frontend/src/app/shared/utils/achievement-icon.ts`
- Modify: `frontend/src/app/achievements/achievements.component.ts` (remove the exported helper, import instead)

**Interfaces:**
- Produces: `achievementIconPath(a: { tier: string; name: string }): string` — returns `assets/achievements/{tier}-{slug}.png`. Task 2 imports it from `../../utils/achievement-icon` (relative to the dialog folder); the achievements page imports it from `../shared/utils/achievement-icon`.

- [ ] **Step 1: Create the util**

```ts
// frontend/src/app/shared/utils/achievement-icon.ts
export function achievementIconPath(a: { tier: string; name: string }): string {
  const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  return `assets/achievements/${a.tier}-${slug}.png`;
}
```

- [ ] **Step 2: Rewire the achievements page**

In `frontend/src/app/achievements/achievements.component.ts`:

Delete this block (it sits between the `LOCKED_FRAME_SHADOW` const and the `@Component` for `app-achievement-card`):

```ts
export function achievementIconPath(a: AchievementStatus): string {
  const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  return `assets/achievements/${a.tier}-${slug}.png`;
}
```

Add to the imports at the top of the file:

```ts
import { achievementIconPath } from '../shared/utils/achievement-icon';
```

The two usages (`get iconPath()` in `AchievementCardComponent` and `iconPath(a)` in `AchievementsComponent`) keep working unchanged.

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete` (warnings about bundle budget are pre-existing and fine).

---

### Task 2: Achievement splash

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`
  - styles: replace the `/* achievement overlay */` CSS block (`.ach-overlay` through `.ach-tag`, keeping `.ach-next`)
  - template: replace the `<!-- Achievement unlock overlay -->` block
  - class: add `displayedXp` ticker, `rarityLabel`, `achievementArt`; remove `tierLabel`

**Interfaces:**
- Consumes: `achievementIconPath` from Task 1.
- Produces: CSS classes `.splash`, `.splash-art`, `.splash-wash`, `.splash-flash`, `.splash-shimmer`, `.splash-content`, `.splash-item`, `.splash-tag`, `.splash-tier`, `.splash-name`, `.splash-desc`, `.splash-xp` and keyframes `s4y-kenburns`, `s4y-flash`, `s4y-shimmer`, `s4y-rise` — Task 3 reuses all of them.

- [ ] **Step 1: Add the import**

At the top of `log-activity-dialog.component.ts`, next to the existing model imports:

```ts
import { achievementIconPath } from '../../utils/achievement-icon';
```

- [ ] **Step 2: Replace the achievement-overlay CSS**

Delete the CSS rules `.ach-overlay`, `.ach-badge` (and its `.bronze/.silver/.gold` variants), `.ach-title`, `.ach-desc`, `.ach-xp`, `.ach-tag`. KEEP `.ach-next` and `.ach-next:active` (the button style is reused). In their place add:

```css
/* unlock splash (achievements + avatars) */
.splash {
  position:absolute; inset:0; border-radius:34px; z-index:50;
  overflow:hidden; display:flex; flex-direction:column; justify-content:flex-end;
  background:#0e1a34;
}
.splash-art {
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  animation:s4y-kenburns 8s ease-out both;
}
@keyframes s4y-kenburns { from { transform:scale(1); } to { transform:scale(1.12); } }
.splash-wash { position:absolute; inset:0; }
.splash-wash.bronze { background:linear-gradient(180deg, transparent 38%, rgba(74,42,10,.82) 72%, rgba(46,24,4,.97)); }
.splash-wash.silver { background:linear-gradient(180deg, transparent 38%, rgba(42,52,70,.82) 72%, rgba(20,28,42,.97)); }
.splash-wash.gold   { background:linear-gradient(180deg, transparent 38%, rgba(96,62,0,.82) 72%, rgba(58,36,0,.97)); }
.splash-wash.blue   { background:linear-gradient(180deg, transparent 38%, rgba(23,59,146,.82) 72%, rgba(12,30,74,.97)); }
.splash-flash { position:absolute; inset:0; z-index:60; pointer-events:none; animation:s4y-flash .4s ease-out both; }
.splash-flash.bronze { background:#F5D3A3; }
.splash-flash.silver { background:#E8EEF7; }
.splash-flash.gold   { background:#FDE9A7; }
.splash-flash.blue   { background:#9db3dd; }
@keyframes s4y-flash { from { opacity:.9; } to { opacity:0; } }
.splash-shimmer {
  position:absolute; inset:0; z-index:55; pointer-events:none;
  background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,.4) 48%, transparent 60%);
  background-size:220% 100%; animation:s4y-shimmer 1.6s ease-out .3s both;
}
@keyframes s4y-shimmer { from { background-position:220% 0; } to { background-position:-120% 0; } }
.splash-content { position:relative; z-index:58; padding:0 30px 28px; }
.splash-item { animation:s4y-rise .5s cubic-bezier(.2,.7,.3,1) both; }
@keyframes s4y-rise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
.splash-tag { font-family:'Chakra Petch',sans-serif; font-size:11px; letter-spacing:.28em; font-weight:700; color:#C6E63B; text-shadow:0 0 14px rgba(198,230,59,.6); margin-bottom:8px; }
.splash-tier { font-family:'Chakra Petch',sans-serif; font-size:12px; letter-spacing:.24em; font-weight:700; margin-bottom:6px; }
.splash-tier.bronze { color:#F5D3A3; }
.splash-tier.silver { color:#dfe7f2; }
.splash-tier.gold   { color:#FDE9A7; }
.splash-name { font-family:'Chakra Petch',sans-serif; font-size:32px; font-weight:700; color:#fff; line-height:1.05; margin-bottom:6px; text-shadow:0 4px 18px rgba(0,0,0,.5); }
.splash-desc { font-family:'Nunito',sans-serif; font-size:14px; color:rgba(255,255,255,.85); margin-bottom:10px; max-width:300px; }
.splash-xp { font-family:'Chakra Petch',sans-serif; font-size:22px; font-weight:700; color:#C6E63B; letter-spacing:.05em; margin-bottom:16px; text-shadow:0 0 16px rgba(198,230,59,.5); }
.splash-confetti { position:absolute; border-radius:2px; z-index:57; }
```

- [ ] **Step 3: Replace the achievement-overlay template**

Replace this template block:

```html
      <!-- Achievement unlock overlay (queued, shown on top of conf) -->
      @if (currentAchievement) {
      <div class="ach-overlay">
        <div class="ach-tag">ACHIEVEMENT UNLOCKED</div>
        <div class="ach-badge" [class]="currentAchievement.tier">
          {{ tierLabel(currentAchievement.tier) }}
        </div>
        <div class="ach-title">{{ currentAchievement.name }}</div>
        <div class="ach-desc">{{ currentAchievement.description }}</div>
        <div class="ach-xp">+{{ currentAchievement.xpReward }} XP</div>
        <button class="ach-next" (click)="nextAchievement()">
          {{ achievementQueue.length > 0 ? 'NEXT →' : 'AWESOME! 🏅' }}
        </button>
      </div>
      }
```

with (the `@for` over a one-element array recreates the DOM per queued achievement so entry animations restart — a plain `@if` would keep the same nodes and only animate once):

```html
      <!-- Achievement unlock splash (queued, shown on top of conf) -->
      @for (ach of currentAchievement ? [currentAchievement] : []; track ach.id) {
      <div class="splash">
        <img class="splash-art" [src]="achievementArt(ach)" [alt]="ach.name">
        <div class="splash-wash" [class]="ach.tier"></div>
        @if (ach.tier === 'gold') { <div class="splash-shimmer"></div> }
        <div class="splash-flash" [class]="ach.tier"></div>
        <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
        <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
        <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
        <div class="splash-confetti" style="left:84%;top:11%;width:10px;height:10px;background:#C6E63B;border-radius:50%;animation:s4y-conf 3.1s ease-in .1s infinite;"></div>
        <div class="splash-confetti" style="left:26%;top:4%;width:9px;height:9px;background:#FFD54A;animation:s4y-conf 2.6s ease-in .7s infinite;"></div>
        <div class="splash-content">
          <div class="splash-item splash-tag" style="animation-delay:.15s">ACHIEVEMENT UNLOCKED</div>
          <div class="splash-item splash-tier" [class]="ach.tier" style="animation-delay:.23s">
            {{ ach.tier.toUpperCase() }} · {{ rarityLabel(ach.tier) }}
          </div>
          <div class="splash-item splash-name" style="animation-delay:.31s">{{ ach.name }}</div>
          <div class="splash-item splash-desc" style="animation-delay:.39s">{{ ach.description }}</div>
          <div class="splash-item splash-xp" style="animation-delay:.47s">+{{ displayedXp }} XP</div>
          <button class="splash-item ach-next" style="animation-delay:.55s" (click)="nextAchievement()">
            {{ achievementQueue.length > 0 ? 'NEXT →' : 'AWESOME! 🏅' }}
          </button>
        </div>
      </div>
      }
```

Note: `s4y-conf` is an existing global keyframe already used by the confirmation overlay — do not redefine it.

- [ ] **Step 4: Class changes — XP ticker, rarity label, art path**

In the `LogActivityDialogComponent` class:

Add fields next to `currentAchievement`:

```ts
  displayedXp = 0;
  private xpTickerId = 0;
```

Add methods; DELETE the now-unused `tierLabel` method:

```ts
  rarityLabel(tier: string): string {
    return { bronze: 'COMMON', silver: 'RARE', gold: 'LEGENDARY' }[tier] ?? '';
  }

  achievementArt(a: UnlockedAchievement): string {
    return achievementIconPath(a);
  }

  private startXpTicker(target: number): void {
    cancelAnimationFrame(this.xpTickerId);
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayedXp = Math.round(target * eased);
      if (t < 1) this.xpTickerId = requestAnimationFrame(tick);
    };
    this.xpTickerId = requestAnimationFrame(tick);
  }
```

In `logActivity()`, after `this.currentAchievement = achievements[0];` add:

```ts
          this.startXpTicker(achievements[0].xpReward);
```

Replace `nextAchievement()` with:

```ts
  nextAchievement(): void {
    this.currentAchievement = this.achievementQueue.shift() ?? null;
    if (this.currentAchievement) {
      this.startXpTicker(this.currentAchievement.xpReward);
    } else if (this.avatarQueue.length > 0) {
      this.currentAvatar = this.avatarQueue.shift() ?? null;
    }
  }
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete`, no `tierLabel`/`ach-overlay` errors.

---

### Task 3: Avatar splash

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`
  - styles: delete the `/* avatar overlay */` block (`.av-overlay`, `.av-img`, `.av-tag`, `.av-title`, `.av-desc`)
  - template: replace the `<!-- Avatar unlock overlay -->` block

**Interfaces:**
- Consumes: `.splash*` CSS classes from Task 2.

- [ ] **Step 1: Delete the avatar-overlay CSS**

Remove the rules `.av-overlay`, `.av-img`, `.av-tag`, `.av-title`, `.av-desc` (the whole `/* avatar overlay */` section). Task 2's splash classes replace them.

- [ ] **Step 2: Replace the avatar-overlay template**

Replace:

```html
      <!-- Avatar unlock overlay (shown after all achievement overlays) -->
      @if (currentAvatar) {
      <div class="av-overlay">
        <div class="av-tag">AVATAR UNLOCKED</div>
        <img class="av-img" [src]="currentAvatar.imagePath" [alt]="currentAvatar.name">
        <div class="av-title">{{ currentAvatar.name }}</div>
        <div class="av-desc">{{ currentAvatar.description }}</div>
        <button class="ach-next" (click)="nextAvatar()">
          {{ avatarQueue.length > 0 ? 'NEXT →' : 'NICE! 🎭' }}
        </button>
      </div>
      }
```

with:

```html
      <!-- Avatar unlock splash (shown after all achievement splashes) -->
      @for (av of currentAvatar ? [currentAvatar] : []; track av.id) {
      <div class="splash">
        <img class="splash-art" [src]="av.imagePath" [alt]="av.name">
        <div class="splash-wash blue"></div>
        <div class="splash-flash blue"></div>
        <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
        <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
        <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
        <div class="splash-content">
          <div class="splash-item splash-tag" style="animation-delay:.15s">AVATAR UNLOCKED</div>
          <div class="splash-item splash-name" style="animation-delay:.23s">{{ av.name }}</div>
          <div class="splash-item splash-desc" style="animation-delay:.31s">{{ av.description }}</div>
          <button class="splash-item ach-next" style="animation-delay:.39s" (click)="nextAvatar()">
            {{ avatarQueue.length > 0 ? 'NEXT →' : 'NICE! 🎭' }}
          </button>
        </div>
      </div>
      }
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete`, no `av-overlay` references remain (`grep -c "av-overlay" frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` → 0).

---

### Task 4: Runtime verification (Playwright)

**Files:**
- Create (scratch, not committed): `<scratchpad>/splash-verify.mjs`

**Interfaces:**
- Consumes: running backend (5262) + frontend (4200); Playwright installed in the scratchpad from the earlier session (`npm install playwright` there if missing).

- [ ] **Step 1: Ensure servers are running**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5262/api/leaderboard   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4200                   # expect 200
```

If either fails: backend `cd backend/Sport4You.Api && dotnet run` (build first if needed), frontend `cd frontend && npx ng serve`.

- [ ] **Step 2: Write and run the verification script**

A fresh user logging a single 200 km run unlocks a queue spanning bronze (First Blood, First Strides), silver (Road Warrior), and gold (Marathon Legend, Centurion) plus at least one avatar — covering every splash variant.

```js
// splash-verify.mjs
import { chromium } from 'playwright';

const reg = await fetch('http://localhost:5262/api/users', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName: 'Splash', lastName: `T${Date.now() % 100000}` }),
}).then(r => r.json());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:4200');
await page.evaluate(id => localStorage.setItem('userId', id), reg.userId);
await page.reload();
await page.click('text=LOG ACTIVITY');
await page.waitForSelector('.amount-input');
await page.fill('.amount-input', '200');   // running is the default sport
await page.click('.log-btn');
await page.waitForSelector('.splash', { timeout: 10000 });

let shot = 0;
while (await page.locator('.splash').count() > 0) {
  await page.waitForTimeout(1300);          // let stagger + ticker finish
  await page.screenshot({ path: `splash-${shot++}.png` });
  await page.click('.splash button');
  await page.waitForTimeout(400);
  if (shot > 12) break;                      // safety
}
console.log('splashes shown:', shot, '| page errors:', errors.length ? errors : 'none');
await browser.close();
```

Run: `node splash-verify.mjs`
Expected: `splashes shown: >=5 | page errors: none`

- [ ] **Step 3: Inspect the screenshots**

Read each `splash-N.png` and confirm:
- artwork fills the dialog, no letterboxing
- bronze splash has warm brown wash; gold has amber wash + shimmer visible in at least one frame
- tier line reads e.g. `GOLD · LEGENDARY`; XP shows the full reward value (ticker finished)
- last achievement button reads `AWESOME! 🏅`; queued ones read `NEXT →`
- avatar splash (blue wash, `AVATAR UNLOCKED`) appears after achievements

- [ ] **Step 4: Report results to Antonio with screenshots — no commit (he commits himself)**
