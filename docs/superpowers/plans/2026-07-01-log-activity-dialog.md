# Log Activity Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Log Activity" dialog accessible from the navbar and dashboard FAB, using a sport-card picker and adaptive metric input.

**Architecture:** Three tasks — extract shared sport constants, build the dialog component, wire up both entry points. The dialog is a standalone Angular Material component opened via `MatDialog`. The dashboard refreshes its data after a successful log.

**Tech Stack:** Angular 17 (standalone components) · Angular Material 17 · `FormsModule` (template-driven, no Reactive Forms needed for this simple form) · existing `ApiService.logActivity()`

## Global Constraints

- Angular 17 standalone components — no NgModule, every component declares its own `imports: []`
- Angular Material 17 — all Material components must be listed in the component's `imports` array
- No new backend changes — `POST /api/activities` already handles all sport/metric combos
- No Angular unit tests — manual browser verification is the acceptance gate
- No git commits — user handles all committing
- `userId` always read from `localStorage.getItem('userId')`
- `datetime` always `new Date().toISOString()` (no date picker)
- `MatIconModule` is intentionally absent from existing components — use emoji or text for icons

---

### Task 1: Extract shared sport constants

**Files:**
- Create: `frontend/src/app/shared/constants/sport.constants.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts` (lines 11–27: remove inline SPORT_COLORS/SPORT_ICONS, import from shared file)

**Interfaces:**
- Produces: `SPORT_COLORS`, `SPORT_ICONS`, `SPORTS` — imported by Task 2 and the updated DashboardComponent

- [ ] **Step 1: Create the constants file**

Create `frontend/src/app/shared/constants/sport.constants.ts` with this exact content:

```ts
export const SPORT_COLORS: Record<string, string> = {
  running: '#ef5350',
  walking: '#42a5f5',
  cycling: '#66bb6a',
  swimming: '#26c6da',
  gym: '#ab47bc',
  daily_steps: '#ffa726',
};

export const SPORT_ICONS: Record<string, string> = {
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  swimming: '🏊',
  gym: '🏋️',
  daily_steps: '👟',
};

export const SPORTS = [
  'running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps',
] as const;
```

- [ ] **Step 2: Update DashboardComponent to use shared constants**

Replace the inline `SPORT_COLORS` and `SPORT_ICONS` constant blocks in `frontend/src/app/dashboard/dashboard.component.ts` (lines 11–27) with imports. The top of the file should become:

```ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, ActivityItem } from '../shared/models/dashboard.model';
import { SPORT_COLORS, SPORT_ICONS } from '../shared/constants/sport.constants';
```

Remove the `const SPORT_COLORS` and `const SPORT_ICONS` blocks entirely — those 18 lines are now in the shared file.

- [ ] **Step 3: Verify the app still builds**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: `✔ Building...` with 0 errors. If you see "Cannot find module '...sport.constants'", check the import path is `'../shared/constants/sport.constants'` relative to `dashboard.component.ts`.

---

### Task 2: Build LogActivityDialogComponent

**Files:**
- Create: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: `SPORT_COLORS`, `SPORT_ICONS`, `SPORTS` from `../../constants/sport.constants`
- Consumes: `ApiService.logActivity(request: LogActivityRequest)` from `../../services/api.service`
- Consumes: `LogActivityRequest` from `../../models/dashboard.model`
- Produces: `LogActivityDialogComponent` — opened by Task 3 via `MatDialog.open(LogActivityDialogComponent, { width: '480px' })`
- Produces: dialog closes with `{ points: number }` on success, `undefined` on cancel

- [ ] **Step 1: Create the dialog component**

Create `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`:

```ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { SPORT_COLORS, SPORT_ICONS, SPORTS } from '../../constants/sport.constants';

interface SportMeta {
  label: string;
  kind: 'distance' | 'duration' | 'steps';
  inputType: string;
  placeholder: string;
  step: string;
  min: string;
}

const SPORT_META: Record<string, SportMeta> = {
  running:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '5.0',  step: '0.1', min: '0.1' },
  walking:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '3.0',  step: '0.1', min: '0.1' },
  cycling:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '20.0', step: '0.1', min: '0.1' },
  swimming:    { label: 'Duration (mm:ss)', kind: 'duration', inputType: 'text', placeholder: '30:00', step: '', min: '' },
  gym:         { label: 'Duration (mm:ss)', kind: 'duration', inputType: 'text', placeholder: '45:00', step: '', min: '' },
  daily_steps: { label: 'Steps',          kind: 'steps',    inputType: 'number', placeholder: '8000', step: '1',   min: '1'   },
};

@Component({
  selector: 'app-log-activity-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  styles: [`
    .sports-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .sport-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px 8px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      background: #fafafa;
      user-select: none;
    }
    .sport-card:hover { background: #f0f0f0; }
    .sport-card.selected { background: #fff; }
    .sport-emoji { font-size: 28px; line-height: 1; }
    .sport-name { font-size: 11px; font-weight: 600; margin-top: 4px; text-align: center; color: #444; }
    .metric-field { width: 100%; }
    .error-msg { color: #d32f2f; font-size: 13px; margin-top: 4px; }
    .btn-inner { display: flex; align-items: center; gap: 8px; }
  `],
  template: `
    <h2 mat-dialog-title>Log Activity</h2>
    <mat-dialog-content>
      <div class="sports-grid">
        <div
          *ngFor="let sport of sports"
          class="sport-card"
          [class.selected]="selectedSport === sport"
          [style.border-color]="selectedSport === sport ? sportColors[sport] : '#e0e0e0'"
          (click)="selectSport(sport)"
        >
          <span class="sport-emoji">{{ sportIcons[sport] }}</span>
          <span class="sport-name">{{ formatSport(sport) }}</span>
        </div>
      </div>

      <mat-form-field *ngIf="selectedSport" appearance="outline" class="metric-field">
        <mat-label>{{ meta.label }}</mat-label>
        <input
          matInput
          [(ngModel)]="metricValue"
          [type]="meta.inputType"
          [placeholder]="meta.placeholder"
          [attr.step]="meta.step || null"
          [attr.min]="meta.min || null"
          (ngModelChange)="errorMsg = ''"
        />
      </mat-form-field>

      <p class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="loading">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!canSubmit()"
        (click)="submit()"
      >
        <span class="btn-inner">
          <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
          {{ loading ? 'Logging...' : 'Log Activity' }}
        </span>
      </button>
    </mat-dialog-actions>
  `,
})
export class LogActivityDialogComponent {
  sports = [...SPORTS];
  sportColors = SPORT_COLORS;
  sportIcons = SPORT_ICONS;

  selectedSport: string | null = null;
  metricValue = '';
  loading = false;
  errorMsg = '';

  get meta(): SportMeta {
    return SPORT_META[this.selectedSport!];
  }

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<LogActivityDialogComponent>,
    private snackBar: MatSnackBar,
  ) {}

  selectSport(sport: string) {
    this.selectedSport = sport;
    this.metricValue = '';
    this.errorMsg = '';
  }

  formatSport(sport: string): string {
    return sport.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  canSubmit(): boolean {
    if (!this.selectedSport || !this.metricValue || this.loading) return false;
    if (this.meta.kind === 'duration') return /^\d+:\d{2}$/.test(this.metricValue);
    return Number(this.metricValue) > 0;
  }

  submit() {
    const userId = localStorage.getItem('userId');
    if (!userId || !this.selectedSport) return;

    const body: Record<string, unknown> = {
      userId,
      datetime: new Date().toISOString(),
    };

    if (this.meta.kind === 'distance') {
      body['sport'] = this.selectedSport;
      body['distance'] = parseFloat(this.metricValue);
    } else if (this.meta.kind === 'duration') {
      body['sport'] = this.selectedSport;
      body['duration'] = this.metricValue;
    } else {
      body['steps'] = parseInt(this.metricValue, 10);
    }

    this.loading = true;
    this.api.logActivity(body as any).subscribe({
      next: ({ points }) => {
        this.dialogRef.close({ points });
        this.snackBar.open(`✓ +${points} pts earned!`, '', { duration: 3000 });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.error ?? 'Something went wrong. Please try again.';
      },
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: 0 errors. Common mistakes to check:
- Import path `'../../constants/sport.constants'` is relative to the component's location (`shared/components/log-activity-dialog/`)
- `FormsModule` in `imports` array (needed for `[(ngModel)]`)

---

### Task 3: Wire up entry points

**Files:**
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `LogActivityDialogComponent` from `./shared/components/log-activity-dialog/log-activity-dialog.component`

- [ ] **Step 1: Add "Log Activity" button to the navbar**

Replace the full content of `frontend/src/app/app.component.ts` with:

```ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from './shared/components/register-dialog/register-dialog.component';
import { LogActivityDialogComponent } from './shared/components/log-activity-dialog/log-activity-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary">
      <span style="font-weight: 700; letter-spacing: 1px;">Sport4You 🏆</span>
      <span style="flex: 1"></span>
      <button mat-button routerLink="/leaderboard">Leaderboard</button>
      <button mat-button routerLink="/dashboard">My Dashboard</button>
      <button
        mat-stroked-button
        (click)="openLogActivity()"
        style="margin-left: 8px; color: white; border-color: rgba(255,255,255,0.5);"
      >
        + Log Activity
      </button>
    </mat-toolbar>
    <router-outlet />
  `,
})
export class AppComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px' });
    }
  }

  openLogActivity() {
    this.dialog.open(LogActivityDialogComponent, { width: '480px' });
  }
}
```

- [ ] **Step 2: Add FAB and dashboard refresh to DashboardComponent**

The dashboard needs three changes:
1. Add a FAB button to the template (fixed bottom-right)
2. Extract `loadData()` as a public method so it can be called after dialog close
3. Open `LogActivityDialogComponent` and call `loadData()` on success

Replace the full content of `frontend/src/app/dashboard/dashboard.component.ts` with:

```ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, ActivityItem } from '../shared/models/dashboard.model';
import { SPORT_COLORS, SPORT_ICONS } from '../shared/constants/sport.constants';
import { LogActivityDialogComponent } from '../shared/components/log-activity-dialog/log-activity-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    BaseChartDirective,
  ],
  styles: [`
    .container { max-width: 900px; margin: 32px auto; padding: 0 16px; }
    .hero { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; flex-wrap: wrap; }
    .hero-points { font-size: 64px; font-weight: 800; color: #1976d2; line-height: 1; }
    .hero-label { font-size: 16px; color: #666; margin-top: 4px; }
    .hero-name { font-size: 28px; font-weight: 700; }
    .streak {
      display: flex; align-items: center; gap: 8px;
      background: #fff3e0; border-radius: 12px; padding: 12px 20px;
      font-size: 18px; font-weight: 600; color: #e65100;
    }
    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    @media (max-width: 640px) { .charts-row { grid-template-columns: 1fr; } }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #333; }
    .activity-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid #f0f0f0;
    }
    .activity-item:last-child { border-bottom: none; }
    .activity-sport { font-weight: 600; font-size: 15px; }
    .activity-meta { color: #888; font-size: 13px; margin-top: 2px; }
    .activity-points { font-weight: 700; color: #1976d2; font-size: 16px; }
    .feed { max-height: 400px; overflow-y: auto; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .fab {
      position: fixed; bottom: 32px; right: 32px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #1976d2; color: white;
      font-size: 28px; line-height: 1;
      border: none; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, box-shadow 0.15s;
    }
    .fab:hover { background: #1565c0; box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
  `],
  template: `
    <div class="container">
      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48" />
      </div>

      <ng-container *ngIf="!loading && data">
        <!-- Hero -->
        <div class="hero">
          <div>
            <div class="hero-name">{{ data.user.firstName }} {{ data.user.lastName }}</div>
            <div class="hero-points">{{ data.totalPoints | number }}</div>
            <div class="hero-label">total points</div>
          </div>
          <div class="streak" *ngIf="streak > 0">
            🔥 {{ streak }}-day streak
          </div>
        </div>

        <!-- Charts row -->
        <div class="charts-row">
          <mat-card>
            <mat-card-content>
              <div class="section-title">Points Over Time</div>
              <canvas baseChart
                [data]="lineChartData"
                [options]="lineChartOptions"
                type="line">
              </canvas>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-content>
              <div class="section-title">Activity Mix</div>
              <canvas baseChart
                [data]="doughnutChartData"
                [options]="doughnutChartOptions"
                type="doughnut">
              </canvas>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Activity feed -->
        <mat-card>
          <mat-card-content>
            <div class="section-title">Activity History</div>
            <div class="feed">
              <div class="activity-item" *ngFor="let a of data.activities">
                <div>
                  <div class="activity-sport">
                    {{ sportIcon(a.sport) }} {{ formatSport(a.sport) }}
                  </div>
                  <div class="activity-meta">
                    {{ formatDate(a.dateTime) }} &nbsp;·&nbsp; {{ formatMetric(a) }}
                  </div>
                </div>
                <div class="activity-points">+{{ a.points }} pts</div>
              </div>
              <div *ngIf="data.activities.length === 0" style="color: #999; padding: 16px 0;">
                No activities yet — start logging!
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </ng-container>

      <ng-container *ngIf="!loading && !data">
        <mat-card><mat-card-content>User not found.</mat-card-content></mat-card>
      </ng-container>
    </div>

    <!-- FAB -->
    <button class="fab" (click)="openLogActivity()" title="Log Activity">+</button>
  `,
})
export class DashboardComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  streak = 0;

  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Points' } },
      x: { title: { display: true, text: 'Date' } },
    },
  };

  doughnutChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
  };

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    const userId =
      localStorage.getItem('viewingUserId') ?? localStorage.getItem('userId');
    localStorage.removeItem('viewingUserId');
    if (!userId) { this.loading = false; return; }
    this.loadData(userId);
  }

  loadData(userId?: string) {
    const uid = userId
      ?? localStorage.getItem('viewingUserId')
      ?? localStorage.getItem('userId');
    if (!uid) return;

    this.loading = true;
    this.api.getDashboard(uid).subscribe({
      next: data => {
        this.data = data;
        this.streak = this.calculateStreak(data.activities);
        this.buildLineChart(data);
        this.buildDoughnutChart(data);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load dashboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  openLogActivity() {
    const ref = this.dialog.open(LogActivityDialogComponent, { width: '480px' });
    ref.afterClosed().subscribe(result => {
      if (result?.points !== undefined) {
        this.loadData();
      }
    });
  }

  private buildLineChart(data: DashboardData) {
    this.lineChartData = {
      labels: data.pointsOverTime.map(p => p.date),
      datasets: [{
        label: 'Daily Points',
        data: data.pointsOverTime.map(p => p.points),
        fill: true,
        tension: 0.4,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        pointBackgroundColor: '#1976d2',
        pointRadius: 4,
      }],
    };
  }

  private buildDoughnutChart(data: DashboardData) {
    this.doughnutChartData = {
      labels: data.sportBreakdown.map(s => this.formatSport(s.sport)),
      datasets: [{
        data: data.sportBreakdown.map(s => s.points),
        backgroundColor: data.sportBreakdown.map(s => SPORT_COLORS[s.sport] ?? '#90a4ae'),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }

  private calculateStreak(activities: ActivityItem[]): number {
    if (!activities.length) return 0;

    const uniqueDates = [...new Set(
      activities.map(a => new Date(a.dateTime).toDateString())
    )].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let cursor = today;

    for (const date of uniqueDates) {
      const diffDays = Math.round(
        (cursor.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 0 || diffDays === 1) {
        streak++;
        cursor = date;
      } else {
        break;
      }
    }

    return streak;
  }

  formatSport(sport: string): string {
    return sport.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  sportIcon(sport: string): string {
    return SPORT_ICONS[sport] ?? '🏅';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  formatMetric(a: ActivityItem): string {
    if (a.distance != null) return `${a.distance} km`;
    if (a.duration != null) return a.duration;
    if (a.steps != null) return `${a.steps.toLocaleString()} steps`;
    return '';
  }
}
```

- [ ] **Step 3: Build and verify**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Smoke test in the browser**

```bash
# Terminal 1 — backend
cd backend && dotnet run --project Sport4You.Api

# Terminal 2 — frontend
cd frontend && npx ng serve
```

Open `http://localhost:4200`. Check:

1. Navbar shows "+ Log Activity" button on every page
2. Clicking it opens the dialog with a 3×2 sport card grid
3. Clicking a sport card highlights it with its color border
4. A metric input appears below the cards
5. Submit button is disabled until both sport and a valid value are entered
6. Duration validation: typing `"abc"` keeps submit disabled; `"30:00"` enables it
7. Submitting logs the activity and shows `"✓ +N pts earned!"` snackbar
8. After logging on the dashboard page, the activity feed and hero points refresh
9. Dashboard FAB (blue circle `+`) appears bottom-right and opens the same dialog
10. Cancelling the dialog returns to the previous state without side effects
