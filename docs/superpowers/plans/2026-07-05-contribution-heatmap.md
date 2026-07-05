# Contribution Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub-style contribution heatmap on the profile page, built entirely from data already returned by the existing dashboard endpoint.

**Architecture:** One new standalone, presentation-only Angular component that transforms `DashboardData.pointsOverTime` into a 53×7 grid client-side. No backend changes, no new API calls — the profile page already fetches everything needed.

**Tech Stack:** Angular 17 standalone component (no external calendar/chart library — hand-rolled CSS grid, consistent with the rest of the app).

**Spec:** `docs/superpowers/specs/2026-07-05-contribution-heatmap-design.md`

## Global Constraints

- **NEVER `git add`/`git commit`.** Antonio commits himself.
- No backend changes of any kind — this task touches only `frontend/`.
- Frontend check: `cd frontend && npx ng build 2>&1 | tail -5` (pre-existing bundle-budget warnings are fine).

---

### Task 1: `ContributionHeatmapComponent`

**Files:**
- Create: `frontend/src/app/profile/contribution-heatmap/contribution-heatmap.component.ts`
- Modify: `frontend/src/app/profile/profile.component.ts`

**Interfaces:**
- Produces: `<app-contribution-heatmap [pointsOverTime]="data.pointsOverTime">` — no outputs, no other consumers.
- Consumes: `DashboardData.pointsOverTime: { date: string; points: number }[]` (already exists, `date` is `"yyyy-MM-dd"`).

- [ ] **Step 1: Create the component**

```ts
// frontend/src/app/profile/contribution-heatmap/contribution-heatmap.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HeatmapDay {
  date: Date;
  dateKey: string;
  points: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

interface HeatmapWeek {
  days: HeatmapDay[];
  monthLabel: string | null; // set on the week whose first new month starts here
}

const LEVEL_COLORS = ['#EAEEF6', '#EAF7C9', '#C6E63B', '#9ECF10', '#7c9c00'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_MS = 86_400_000;

function levelFor(points: number): 0 | 1 | 2 | 3 | 4 {
  if (points <= 0) return 0;
  if (points < 150) return 1;
  if (points < 350) return 2;
  if (points < 700) return 3;
  return 4;
}

// The backend groups activities by the server's LOCAL calendar date (its
// DateTime.TryParse converts incoming UTC 'Z' timestamps to server-local
// time before truncating to .Date), so pointsOverTime's "yyyy-MM-dd" keys
// are server-local calendar days. Build the matching key from this Date's
// own local Y/M/D fields — never round-trip through toISOString()/UTC,
// which silently shifts the date by a day for any timezone ahead of UTC.
// (Verified live during Task 2: an initial toISOString()-based version
// shifted every date back one day for a UTC+2 viewer, dropping "today"'s
// points off the grid entirely.)
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-contribution-heatmap',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
    .wrap { overflow-x: auto; padding-bottom: 4px; }
    .grid { display: flex; gap: 3px; width: max-content; }
    .week-col { display: flex; flex-direction: column; gap: 3px; position: relative; }
    .month-label {
      position: absolute; top: 0; left: 0;
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      color: #8592ad; letter-spacing: .04em; white-space: nowrap;
    }
    .months-row { position: relative; height: 18px; }
    .cell {
      width: 11px; height: 11px; border-radius: 3px; background: #EAEEF6;
      cursor: default; transition: outline .1s;
    }
    .cell.future { visibility: hidden; }
    .cell:hover { outline: 2px solid #2E6BE6; outline-offset: 1px; }
    .legend { display: flex; align-items: center; gap: 5px; margin-top: 12px; justify-content: flex-end; }
    .legend span { font-size: 11px; color: #8592ad; }
    .legend .cell { cursor: default; }
    .legend .cell:hover { outline: none; }
    .empty { font-size: 13px; color: #b0bcd4; }
  `],
  template: `
    @if (weeks.length === 0) {
      <div class="empty">No activity yet.</div>
    } @else {
      <div class="wrap">
        <div class="grid">
          @for (week of weeks; track $index) {
            <div class="week-col">
              @if (week.monthLabel) {
                <div class="months-row"><span class="month-label">{{ week.monthLabel }}</span></div>
              } @else {
                <div class="months-row"></div>
              }
              @for (day of week.days; track day.dateKey) {
                <div class="cell" [class.future]="day.isFuture"
                     [style.background]="levelColors[day.level]"
                     [title]="day.isFuture ? '' : (day.points > 0 ? (day.date | date:'MMM d') + ' · ' + day.points + ' pts' : (day.date | date:'MMM d') + ' · No activity')">
                </div>
              }
            </div>
          }
        </div>
      </div>
      <div class="legend">
        <span>Less</span>
        @for (color of levelColors; track $index) {
          <div class="cell" [style.background]="color"></div>
        }
        <span>More</span>
      </div>
    }
  `,
})
export class ContributionHeatmapComponent implements OnChanges {
  @Input() pointsOverTime: { date: string; points: number }[] = [];

  readonly levelColors = LEVEL_COLORS;
  weeks: HeatmapWeek[] = [];

  ngOnChanges(): void {
    this.weeks = this.buildGrid();
  }

  private buildGrid(): HeatmapWeek[] {
    const pointsByDate = new Map<string, number>();
    for (const p of this.pointsOverTime) pointsByDate.set(p.date, p.points);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start on the Sunday on/before (today - 364 days), so the grid always
    // has full weeks and ends on today's column.
    const start = new Date(today.getTime() - 364 * DAY_MS);
    start.setDate(start.getDate() - start.getDay());

    const weeks: HeatmapWeek[] = [];
    let cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= today || cursor.getDay() !== 0) {
      const days: HeatmapDay[] = [];
      let monthLabel: string | null = null;

      for (let d = 0; d < 7; d++) {
        const isFuture = cursor > today;
        const key = dateKey(cursor);
        const points = pointsByDate.get(key) ?? 0;

        if (!isFuture && cursor.getMonth() !== lastMonth && cursor.getDate() <= 7) {
          monthLabel = MONTH_NAMES[cursor.getMonth()];
          lastMonth = cursor.getMonth();
        }

        days.push({
          date: new Date(cursor), dateKey: key, points,
          level: levelFor(points), isFuture,
        });
        cursor = new Date(cursor.getTime() + DAY_MS);
      }

      weeks.push({ days, monthLabel });
      if (cursor > today && cursor.getDay() === 0) break;
    }

    return weeks;
  }
}
```

- [ ] **Step 2: Wire into the profile page**

In `profile.component.ts`, add the import:

```ts
import { ContributionHeatmapComponent } from './contribution-heatmap/contribution-heatmap.component';
```

Add `ContributionHeatmapComponent` to the `@Component` `imports: [...]` array (alongside `AvatarLockerComponent`).

In the template, insert a new section immediately after the closing `</div>` of `.hero-card` and before the existing `<div class="section"><div class="section-title">ACHIEVEMENTS</div>`:

```html
          <div class="section">
            <div class="section-title">ACTIVITY</div>
            <app-contribution-heatmap [pointsOverTime]="data.pointsOverTime"></app-contribution-heatmap>
          </div>
```

(Reuses the existing `.section`/`.section-title` classes already defined in this file — no new page-level CSS needed.)

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete`.

---

### Task 2: Runtime verification (Playwright)

- [ ] **Step 1: Ensure servers are running**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5262/api/leaderboard   # expect 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:4200                   # expect 200
```

- [ ] **Step 2: Seed a user with activity spread across multiple months, then verify**

A fresh user only has "today" data, which still exercises the grid (one non-zero cell) but is a weak visual check. Backdate a few activities via the API directly (the datetime field accepts any ISO date) to spread points across the grid:

```js
// heatmap-verify.mjs
import { chromium } from 'playwright';

const reg = await fetch('http://localhost:5262/api/users', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName: 'Heatmap', lastName: `T${Date.now() % 100000}` }),
}).then(r => r.json());

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
for (const [days, km] of [[300, 5], [200, 20], [100, 2], [30, 8], [1, 12]]) {
  await fetch('http://localhost:5262/api/activities', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: reg.userId, sport: 'running', distance: km, datetime: daysAgo(days) }),
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:4200');
await page.evaluate(id => localStorage.setItem('userId', id), reg.userId);
await page.goto(`http://localhost:4200/profile/${reg.userId}`);
await page.waitForSelector('app-contribution-heatmap .grid', { timeout: 10000 });

const weekCount = await page.locator('app-contribution-heatmap .week-col').count();
const nonZeroCells = await page.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('app-contribution-heatmap .cell:not(.future)'));
  return cells.filter(c => getComputedStyle(c).backgroundColor !== 'rgb(234, 238, 246)').length;
});
await page.screenshot({ path: 'heatmap.png' });

// hover a non-zero cell and confirm a tooltip (title attr) is present
const cellWithTitle = page.locator('app-contribution-heatmap .cell[title*="pts"]').first();
const tooltipText = await cellWithTitle.getAttribute('title');

console.log('weeks:', weekCount, '| non-zero cells:', nonZeroCells, '| tooltip sample:', tooltipText, '| page errors:', errors.length ? errors : 'none');
await browser.close();
```

Run: `node heatmap-verify.mjs`
Expected: `weeks: 53` (or 52/53 depending on today's weekday), `non-zero cells: >=5`, a tooltip string containing "pts", `page errors: none`.

- [ ] **Step 3: Inspect `heatmap.png`** — confirm the grid renders under an "ACTIVITY" section title, month labels appear along the top, colors visibly vary by intensity, and the legend ("Less" → 5 swatches → "More") is present. Report to Antonio with the screenshot — no commit (Antonio commits himself).
