# Video Confirmation Splash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the "ACTIVITY LOGGED" confirmation overlay as a full-bleed sport-video splash matching the unlock-splash language (wash, staggered rise, count-up, confetti).

**Architecture:** Single-file change to the log-activity dialog (inline styles + template, the repo's pattern). The existing `startXpTicker` rAF logic is generalized into one `startCountUp` used by both the XP and the new points ticker.

**Tech Stack:** Angular 17 standalone components, CSS keyframes, `requestAnimationFrame`.

**Spec:** `docs/superpowers/specs/2026-07-03-video-confirmation-splash-design.md`

## Global Constraints

- **NEVER commit.** Antonio handles all git commits himself. No `git add`/`git commit` steps anywhere.
- No frontend unit-test harness; the per-task check is `cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build 2>&1 | tail -5` (pre-existing bundle-budget warnings are fine). Runtime verification is Task 2 (Playwright).
- Match existing style: `s4y-` keyframe prefix, Chakra Petch/Nunito, `#C6E63B` lime.
- Do not touch `done()`, mission snackbars, or the achievement/avatar splash blocks.

---

### Task 1: Confirmation video splash

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: existing CSS classes `.splash-content`, `.splash-item`, `.splash-tag`, `.splash-confetti`, `.splash-wash`, `.splash-flash`, `.ach-next`, keyframe `s4y-rise`, global keyframe `s4y-conf`; component members `sport` (getter), `displayValue` (getter), `earnedPoints`, `earnedXp`, `logged`, `done()`.
- Produces: `displayedPoints: number` field; `startCountUp(prop, target)` private method (replaces `startXpTicker` internals); CSS classes `.conf-splash`, `.splash-video`, `.splash-fallback`, `.splash-pose`, `.splash-wash.dark`, `.splash-flash.lime`, `.conf-points`, `.conf-sub`, `.conf-sub-xp`, `.conf-pill-row`.

- [ ] **Step 1: Replace the confirmation-overlay CSS**

In the component's `styles`, DELETE these rules from the `/* confirmation overlay */` section: `.conf`, `.conf-particle`, `.conf-tag`, `.conf-mascot`, `.conf-mascot-shadow`, `.conf-mascot img`, `.conf-pts`, `.conf-pts-label`, `.conf-xp`, `.conf-done`, `.conf-done:active`. KEEP `.conf-pill` exactly as it is.

In their place add:

```css
    /* confirmation splash (video background) */
    .conf-splash {
      position:relative; margin:-26px -30px -30px; min-height:540px;
      border-radius:34px; overflow:hidden; background:#0e1a34;
      display:flex; flex-direction:column; justify-content:flex-end;
    }
    .splash-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .splash-fallback { position:absolute; inset:0; }
    .splash-pose {
      position:absolute; right:-10px; bottom:0; height:78%; object-fit:contain;
      filter:drop-shadow(0 12px 16px rgba(0,0,0,.35));
    }
    .splash-wash.dark { background:linear-gradient(180deg, transparent 38%, rgba(9,16,34,.82) 72%, rgba(5,10,24,.97)); }
    .splash-flash.lime { background:#dff29b; }
    .conf-points {
      font-family:'Chakra Petch',sans-serif; font-size:54px; line-height:.95; font-weight:700;
      color:#fff; text-shadow:0 0 26px rgba(198,230,59,.55); margin-bottom:4px;
    }
    .conf-sub {
      font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700;
      letter-spacing:.24em; color:#C6E63B; margin-bottom:12px;
    }
    .conf-sub-xp { color:#fff; }
    .conf-pill-row { margin-bottom:16px; }
```

Note: `.splash-wash`, `.splash-flash`, `.splash-content`, `.splash-item`, `.splash-tag`, `.splash-confetti` and keyframes `s4y-rise`/`s4y-flash` already exist in the unlock-splash section — do not redefine them.

- [ ] **Step 2: Replace the confirmation-overlay template**

Replace the whole `<!-- Confirmation overlay -->` block (the `@if (logged) { <div class="conf"> … </div> }` with its five `.conf-particle` divs, mascot, points, pill, and DONE button) with:

```html
      <!-- Confirmation splash (video background) -->
      @if (logged) {
      <div class="conf-splash">
        @if (sport.video) {
          <video class="splash-video" [src]="sport.video" [muted]="true" autoplay loop playsinline></video>
        } @else {
          <div class="splash-fallback" [style.background]="sport.bg"></div>
          <img class="splash-pose" [src]="sport.pose" alt="">
        }
        <div class="splash-wash dark"></div>
        <div class="splash-flash lime"></div>
        <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
        <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
        <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
        <div class="splash-confetti" style="left:84%;top:11%;width:10px;height:10px;background:#C6E63B;border-radius:50%;animation:s4y-conf 3.1s ease-in .1s infinite;"></div>
        <div class="splash-confetti" style="left:26%;top:4%;width:9px;height:9px;background:#FFD54A;animation:s4y-conf 2.6s ease-in .7s infinite;"></div>
        <div class="splash-content">
          <div class="splash-item splash-tag" style="animation-delay:.15s">ACTIVITY LOGGED</div>
          <div class="splash-item conf-points" style="animation-delay:.23s">+{{ displayedPoints.toLocaleString('en-US') }}</div>
          <div class="splash-item conf-sub" style="animation-delay:.31s">
            POINTS EARNED@if (earnedXp > 0) {<span class="conf-sub-xp"> · +{{ earnedXp }} XP</span>}
          </div>
          <div class="splash-item conf-pill-row" style="animation-delay:.39s">
            <div class="conf-pill">{{ sport.name.toUpperCase() }} · {{ displayValue }} {{ sport.unit }}</div>
          </div>
          <button class="splash-item ach-next" style="animation-delay:.47s" (click)="done()">DONE 🎉</button>
        </div>
      </div>
      }
```

The `[muted]="true"` property binding is deliberate — a bare `muted` attribute is unreliable in Angular templates and an unmuted video will refuse to autoplay.

- [ ] **Step 3: Generalize the count-up ticker**

In the `LogActivityDialogComponent` class:

Replace the fields

```ts
  displayedXp = 0;
  private xpTickerId = 0;
```

with

```ts
  displayedXp = 0;
  displayedPoints = 0;
  private tickerIds: Record<string, number> = {};
```

Replace the `startXpTicker` method with:

```ts
  private startCountUp(prop: 'displayedXp' | 'displayedPoints', target: number): void {
    cancelAnimationFrame(this.tickerIds[prop] ?? 0);
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      this[prop] = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) this.tickerIds[prop] = requestAnimationFrame(tick);
    };
    this.tickerIds[prop] = requestAnimationFrame(tick);
  }

  private startXpTicker(target: number): void {
    this.startCountUp('displayedXp', target);
  }
```

(Keep `startXpTicker` as the thin wrapper so the two existing call sites in `logActivity()`/`nextAchievement()` stay unchanged.)

In `logActivity()`'s success handler, directly after `this.logged = true;`, add:

```ts
        this.startCountUp('displayedPoints', res.points);
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete`. Also verify no stale references: `grep -c "conf-mascot\|conf-pts\|conf-done\|conf-particle\|conf-tag\|xpTickerId" frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` → `0`.

---

### Task 2: Runtime verification (Playwright)

**Files:**
- Create (scratch, not committed): `<scratchpad>/conf-verify.mjs`

- [ ] **Step 1: Ensure servers are running**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5262/api/leaderboard   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4200                   # expect 200
```

- [ ] **Step 2: Write and run the verification script**

A small running log (0.5 km) avoids triggering unlock splashes on a reused user; a fresh user's first log will show `First Blood` splashes after DONE — the confirmation screen still appears first, which is what we capture. Use one fresh user, two logs: running (video path) then daily steps (fallback path; navigate sports with the right arrow).

```js
// conf-verify.mjs
import { chromium } from 'playwright';

const reg = await fetch('http://localhost:5262/api/users', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName: 'Conf', lastName: `T${Date.now() % 100000}` }),
}).then(r => r.json());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:4200');
await page.evaluate(id => localStorage.setItem('userId', id), reg.userId);
await page.reload();

// Log 1: running (video background)
await page.click('text=LOG ACTIVITY');
await page.waitForSelector('.amount-input');
await page.click('mat-dialog-container .log-btn');
await page.waitForSelector('.conf-splash', { timeout: 10000 });
await page.waitForTimeout(1200);  // stagger + count-up done
const videoState = await page.evaluate(() => {
  const v = document.querySelector('.conf-splash video');
  return v ? { present: true, paused: v.paused } : { present: false };
});
await page.screenshot({ path: 'conf-running.png' });
// dismiss confirmation + any unlock splashes behind it
await page.click('.conf-splash button');
while (await page.locator('.splash').count() > 0) {
  await page.click('.splash button');
  await page.waitForTimeout(300);
}

// Log 2: daily steps (fallback background) — arrow right 5x from running
await page.click('text=LOG ACTIVITY');
await page.waitForSelector('.amount-input');
for (let i = 0; i < 5; i++) { await page.click('mat-dialog-container .arrow.right'); await page.waitForTimeout(1150); }
await page.click('mat-dialog-container .log-btn');
await page.waitForSelector('.conf-splash', { timeout: 10000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'conf-steps.png' });

console.log('video:', JSON.stringify(videoState), '| page errors:', errors.length ? errors : 'none');
await browser.close();
```

Run: `node conf-verify.mjs`
Expected: `video: {"present":true,"paused":false} | page errors: none`

- [ ] **Step 3: Inspect screenshots**

- `conf-running.png`: video frame fills dialog, dark wash bottom, `ACTIVITY LOGGED`, `+50` points (0.5 km × 100), `POINTS EARNED · +N XP`, `RUNNING · 0.5 km` pill, `DONE 🎉`.
- `conf-steps.png`: gradient + mascot pose background (no video), `DAILY STEPS · 5,000 steps` pill, points `+50`.

- [ ] **Step 4: Report results with screenshots — no commit (Antonio commits himself)**
