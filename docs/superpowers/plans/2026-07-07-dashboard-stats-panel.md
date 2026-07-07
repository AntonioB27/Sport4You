# Dashboard STATS Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the two assignment-required dashboard charts — sport-mix doughnut and activity-volume-over-time bars — from data the backend already ships.

**Architecture:** A new standalone `StatsPanelComponent` (dashboard child, matching `weight-card`/`today-steps-card`) takes `sportBreakdown` and `pointsOverTime` as inputs and renders two `ng2-charts` charts. Two exported pure helpers (`densifyDaily`, `prepBreakdown`) hold the only non-trivial logic and are unit-tested directly. The dashboard drops the component into the wide left column after Signal Vault.

**Tech Stack:** Angular 17 standalone components, `ng2-charts` + `chart.js` (already globally provided in `app.config.ts`), Karma/Jasmine tests.

## Global Constraints

- No backend changes. No new DTO fields. Assignment API contracts untouched.
- Frontend data source is already present: `DashboardData.sportBreakdown: { sport: string; points: number }[]` and `DashboardData.pointsOverTime: { date: string; points: number }[]` (see `src/app/shared/models/dashboard.model.ts:24-25`).
- Volume metric is **points per day**; window is **14 days**.
- `pointsOverTime` date keys are UTC `yyyy-MM-dd` (backend groups `DateTime.Date` in UTC). All date math in helpers must be UTC to align.
- Match existing HUD styling: Chakra Petch headers, `.sec-bar` accent, `.fx`/`.bevel` card chrome.
- Commits are Antonio's to make. Task steps stage explicit paths only; do not run `git commit`.

---

### Task 1: StatsPanelComponent (helpers + charts)

**Files:**
- Create: `frontend/src/app/dashboard/stats-panel/stats-panel.component.ts`
- Test: `frontend/src/app/dashboard/stats-panel/stats-panel.component.spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks. `SPORT_COLORS` from `../../shared/constants/sport.constants`.
- Produces (used by Task 2): component `selector: 'app-stats-panel'`, class `StatsPanelComponent`, `@Input() sportBreakdown: { sport: string; points: number }[]`, `@Input() pointsOverTime: { date: string; points: number }[]`.
- Produces (used by this task's tests): exported pure functions
  - `densifyDaily(series: { date: string; points: number }[], days: number, today: Date): { date: string; points: number }[]`
  - `prepBreakdown(series: { sport: string; points: number }[]): { sport: string; points: number }[]`
  - `formatSport(s: string): string`

- [ ] **Step 1: Write the failing helper tests**

Create `frontend/src/app/dashboard/stats-panel/stats-panel.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import {
  StatsPanelComponent, densifyDaily, prepBreakdown, formatSport,
} from './stats-panel.component';

describe('stats-panel helpers', () => {
  describe('densifyDaily', () => {
    const today = new Date('2026-07-07T12:00:00Z');

    it('returns exactly `days` entries ending at today (UTC), ascending', () => {
      const out = densifyDaily([], 14, today);
      expect(out.length).toBe(14);
      expect(out[0].date).toBe('2026-06-24');
      expect(out[13].date).toBe('2026-07-07');
    });

    it('zero-fills days with no activity', () => {
      const out = densifyDaily([{ date: '2026-07-05', points: 300 }], 14, today);
      const jul5 = out.find(d => d.date === '2026-07-05')!;
      const jul4 = out.find(d => d.date === '2026-07-04')!;
      expect(jul5.points).toBe(300);
      expect(jul4.points).toBe(0);
    });

    it('drops points that fall outside the window', () => {
      const out = densifyDaily([{ date: '2026-06-01', points: 999 }], 14, today);
      expect(out.some(d => d.points === 999)).toBe(false);
    });
  });

  describe('prepBreakdown', () => {
    it('filters zero-point sports and sorts descending', () => {
      const out = prepBreakdown([
        { sport: 'gym', points: 0 },
        { sport: 'running', points: 100 },
        { sport: 'cycling', points: 400 },
      ]);
      expect(out.map(s => s.sport)).toEqual(['cycling', 'running']);
    });
  });

  describe('formatSport', () => {
    it('title-cases and de-underscores', () => {
      expect(formatSport('running')).toBe('Running');
      expect(formatSport('daily_steps')).toBe('Daily Steps');
    });
  });
});

describe('StatsPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();
  });

  it('renders empty state when both series are empty without throwing', () => {
    const fixture = TestBed.createComponent(StatsPanelComponent);
    fixture.componentRef.setInput('sportBreakdown', []);
    fixture.componentRef.setInput('pointsOverTime', []);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.hasBreakdown).toBe(false);
    expect(fixture.componentInstance.hasVolume).toBe(false);
  });

  it('builds chart data when populated', () => {
    const fixture = TestBed.createComponent(StatsPanelComponent);
    fixture.componentRef.setInput('sportBreakdown', [{ sport: 'running', points: 200 }]);
    fixture.componentRef.setInput('pointsOverTime', [{ date: '2026-07-05', points: 300 }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasBreakdown).toBe(true);
    expect(fixture.componentInstance.doughnutData.datasets[0].data).toEqual([200]);
    expect(fixture.componentInstance.barData.datasets[0].data.length).toBe(14);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/stats-panel.component.spec.ts'`
Expected: FAIL — cannot resolve module `./stats-panel.component` (file not created yet).

- [ ] **Step 3: Create the component**

Create `frontend/src/app/dashboard/stats-panel/stats-panel.component.ts`:

```ts
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SPORT_COLORS } from '../../shared/constants/sport.constants';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;

export function formatSport(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// pointsOverTime keys are UTC yyyy-MM-dd; build the window in UTC so keys line up.
function utcKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function densifyDaily(
  series: { date: string; points: number }[], days: number, today: Date,
): { date: string; points: number }[] {
  const map = new Map(series.map(p => [p.date, p.points]));
  const anchor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: { date: string; points: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = utcKey(anchor - i * DAY_MS);
    out.push({ date: key, points: map.get(key) ?? 0 });
  }
  return out;
}

export function prepBreakdown(
  series: { sport: string; points: number }[],
): { sport: string; points: number }[] {
  return series.filter(s => s.points > 0).sort((a, b) => b.points - a.points);
}

function barLabel(key: string): string {
  return new Date(key + 'T00:00:00Z')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  styles: [`
    :host { display:block; }
    .fx { filter: drop-shadow(0 14px 26px rgba(16,32,62,.16)); }
    .bevel {
      position:relative; background:#fff; box-shadow: inset 0 0 0 1px #E6ECF6; padding:20px 22px;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
    }
    .sec-head { margin-bottom:14px; }
    .sec-title { display:flex; align-items:center; gap:10px; }
    .sec-bar { width:3px; height:16px; background:#2E6BE6; box-shadow:0 0 8px rgba(46,107,230,.6); flex-shrink:0; }
    .sec-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; letter-spacing:.16em; color:#10203E; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .chart-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.14em; color:#8592ad; margin-bottom:8px; }
    .chart-wrap { position:relative; height:200px; }
    .empty { color:#8592ad; font-family:'Nunito',sans-serif; font-size:13px; padding:28px 0; text-align:center; }
    @media (max-width: 520px) { .row { grid-template-columns:1fr; } }
  `],
  template: `
    <div class="fx"><div class="bevel">
      <div class="sec-head">
        <div class="sec-title"><span class="sec-bar"></span><span class="sec-name">STATS</span></div>
      </div>

      @if (!hasBreakdown && !hasVolume) {
        <div class="empty">No activity yet — log something to see your stats.</div>
      } @else {
        <div class="row">
          @if (hasBreakdown) {
            <div>
              <div class="chart-title">SPORT MIX</div>
              <div class="chart-wrap">
                <canvas baseChart [type]="'doughnut'" [data]="doughnutData" [options]="doughnutOptions"></canvas>
              </div>
            </div>
          }
          @if (hasVolume) {
            <div>
              <div class="chart-title">POINTS · LAST 14 DAYS</div>
              <div class="chart-wrap">
                <canvas baseChart [type]="'bar'" [data]="barData" [options]="barOptions"></canvas>
              </div>
            </div>
          }
        </div>
      }
    </div></div>
  `,
})
export class StatsPanelComponent implements OnChanges {
  @Input() sportBreakdown: { sport: string; points: number }[] = [];
  @Input() pointsOverTime: { date: string; points: number }[] = [];

  hasBreakdown = false;
  hasVolume = false;

  doughnutData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  };

  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  ngOnChanges(): void {
    const prepped = prepBreakdown(this.sportBreakdown ?? []);
    this.hasBreakdown = prepped.length > 0;
    this.doughnutData = {
      labels: prepped.map(s => formatSport(s.sport)),
      datasets: [{
        data: prepped.map(s => s.points),
        backgroundColor: prepped.map(s => SPORT_COLORS[s.sport] ?? '#8592ad'),
        borderWidth: 0,
      }],
    };

    const daily = densifyDaily(this.pointsOverTime ?? [], WINDOW_DAYS, new Date());
    this.hasVolume = daily.some(d => d.points > 0);
    this.barData = {
      labels: daily.map(d => barLabel(d.date)),
      datasets: [{
        data: daily.map(d => d.points),
        label: 'Points',
        backgroundColor: '#2E6BE6',
        borderRadius: 3,
      }],
    };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/stats-panel.component.spec.ts'`
Expected: PASS — all helper specs and both component specs green.

- [ ] **Step 5: Stage the files (Antonio commits)**

```bash
git add frontend/src/app/dashboard/stats-panel/stats-panel.component.ts \
        frontend/src/app/dashboard/stats-panel/stats-panel.component.spec.ts
```

Do not run `git commit` — leave that to Antonio.

---

### Task 2: Wire StatsPanelComponent into the dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts` (imports array + import statement + template)

**Interfaces:**
- Consumes: `StatsPanelComponent` (selector `app-stats-panel`, inputs `sportBreakdown`, `pointsOverTime`) from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the import statement**

In `frontend/src/app/dashboard/dashboard.component.ts`, alongside the other child-component imports (near the `WeightCardComponent` import), add:

```ts
import { StatsPanelComponent } from './stats-panel/stats-panel.component';
```

- [ ] **Step 2: Register it in the component `imports` array**

Find the array (currently):

```ts
imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, RouterLink, LootBoxModalComponent, IconComponent, TodayStepsCardComponent, RivalCardComponent, WeightCardComponent],
```

Replace with (append `StatsPanelComponent`):

```ts
imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, RouterLink, LootBoxModalComponent, IconComponent, TodayStepsCardComponent, RivalCardComponent, WeightCardComponent, StatsPanelComponent],
```

- [ ] **Step 3: Insert the panel at the end of the wide left column**

The wide left column is the first `<div class="col">` (opens ~line 343) and currently ends after the Signal Vault block, immediately before the second `<div class="col">` (the RANKINGS column, ~line 477). Insert the panel just before that closing, so it renders under Signal Vault. The surrounding markup to anchor on:

```html
                  }
                </div></div>
              </div>
            </div>
          </div>  <!-- end of wide left col -->

          <div class="col">
            <!-- RANKINGS ... -->
```

Add `<app-stats-panel>` immediately before the `</div>` that closes the wide left `.col` (i.e. right after the Signal Vault block, before `<div class="col">`):

```html
            <app-stats-panel
              [sportBreakdown]="data.sportBreakdown"
              [pointsOverTime]="data.pointsOverTime"></app-stats-panel>
          </div>  <!-- end of wide left col -->

          <div class="col">
```

If the exact closing-`div` nesting differs, confirm by matching the indentation of the first `<div class="col">` open tag; the panel must sit as a direct child of that column, after the Signal Vault block and before the column's closing `</div>`.

- [ ] **Step 4: Verify the build compiles**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds with no template or type errors.

- [ ] **Step 5: Verify the full frontend test suite still passes**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS — existing specs plus the new stats-panel specs, no regressions.

- [ ] **Step 6: Manually verify in the running app**

Run `cd frontend && npx ng serve`, open the dashboard for a user with logged activities, and confirm: the STATS section appears in the wide left column under Signal Vault; the doughnut shows sport mix in `SPORT_COLORS`; the bar chart shows a continuous 14-day timeline with zero-filled gaps. Then check a brand-new user shows the "No activity yet" empty state. (Restart `ng serve` is not needed — no new assets were added.)

- [ ] **Step 7: Stage the file (Antonio commits)**

```bash
git add frontend/src/app/dashboard/dashboard.component.ts
```

Do not run `git commit` — leave that to Antonio.

---

## Self-Review Notes

- **Spec coverage:** sport-mix doughnut (Task 1) → "breakdown of preferred sports" ✓; 14-day zero-filled points bars (Task 1) → "activity volume over time" ✓; new child component + left-column placement (Tasks 1-2) → architecture/placement ✓; empty state ✓; both pure helpers unit-tested ✓; no backend/DTO/contract changes ✓.
- **Placeholders:** none — full code in every step.
- **Type consistency:** helper signatures, input names (`sportBreakdown`, `pointsOverTime`), and public members (`hasBreakdown`, `hasVolume`, `doughnutData`, `barData`) match between Task 1's definition, its tests, and Task 2's template binding.
