import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../shared/services/api.service';
import { WeightEntry } from '../../shared/models/weight.model';

const LB_PER_KG = 2.20462;

@Component({
  selector: 'app-weight-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, BaseChartDirective],
  styles: [`
    :host { display:block; }
    .card { background:#fff; border-radius:20px; box-shadow:0 12px 28px -18px rgba(16,32,62,.35); padding:18px 20px; }
    .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; letter-spacing:.06em; color:#10203E; }
    .unit-toggle { display:flex; gap:4px; background:#EEF2F8; border-radius:9px; padding:3px; }
    .unit-toggle button { border:none; cursor:pointer; background:transparent; color:#8592ad; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; padding:4px 10px; border-radius:7px; }
    .unit-toggle button.active { background:#fff; color:#10203E; box-shadow:0 1px 3px rgba(0,0,0,.12); }
    .stats { display:flex; align-items:baseline; gap:12px; margin:8px 0 4px; }
    .current { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:30px; color:#10203E; }
    .current small { font-size:14px; color:#8592ad; }
    .change { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; }
    .change.down { color:#2f9e4f; } .change.up { color:#e5484d; } .change.flat { color:#8592ad; }
    .togo { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; color:#2E6BE6; margin-left:auto; }
    .chart-wrap { position:relative; height:150px; margin:8px 0 12px; }
    .empty { color:#8592ad; font-family:'Nunito',sans-serif; font-size:13px; padding:24px 0; text-align:center; }
    .row { display:flex; gap:8px; margin-top:8px; }
    .inp { flex:1; border:1px solid #d6e0ee; border-radius:10px; padding:9px 12px; font:inherit; }
    .btn { border:none; cursor:pointer; border-radius:10px; padding:9px 16px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; letter-spacing:.05em; }
    .btn.primary { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; }
    .btn.ghost { background:#fff; border:1px solid #d6e0ee; color:#5c6881; }
    .locked-row { display:flex; align-items:center; margin-top:8px; padding:10px 12px; background:#F5FBE8; border:1px solid #dcefb0; border-radius:10px; }
    .locked-msg { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; color:#5f7a00; }
    .goal-row { display:flex; align-items:center; gap:8px; margin-top:8px; font-family:'Chakra Petch',sans-serif; font-size:12px; color:#5c6881; }
    .goal-row .link { color:#2E6BE6; cursor:pointer; font-weight:700; }
    .err { color:#e5484d; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="card">
      <div class="head">
        <span class="title">⚖️ WEIGHT</span>
        <div class="unit-toggle">
          <button [class.active]="unit==='kg'" (click)="setUnit('kg')">KG</button>
          <button [class.active]="unit==='lb'" (click)="setUnit('lb')">LB</button>
        </div>
      </div>

      @if (entries.length) {
        <div class="stats">
          <span class="current">{{ display(currentKg) | number:'1.1-1' }}<small> {{ unit }}</small></span>
          <span class="change" [class]="changeClass">{{ changeLabel }}</span>
          @if (goalKg != null) { <span class="togo">{{ toGoLabel }}</span> }
        </div>
        <div class="chart-wrap">
          <canvas baseChart [type]="'line'" [data]="chartData" [options]="chartOptions"></canvas>
        </div>
      } @else {
        <div class="empty">No weigh-ins yet — log your first below to start the chart.</div>
      }

      @if (loggedToday) {
        <div class="locked-row">
          <span class="locked-msg">✓ Logged today — {{ display(currentKg) | number:'1.1-1' }} {{ unit }}. Come back tomorrow.</span>
        </div>
      } @else {
        <div class="row">
          <input class="inp" type="number" step="0.1" min="1" [placeholder]="'Weight today (' + unit + ')'"
                 [(ngModel)]="input" [disabled]="loading" (keyup.enter)="log()">
          <button class="btn primary" (click)="log()" [disabled]="loading || !input">Log today</button>
        </div>
      }

      <div class="goal-row">
        @if (editingGoal) {
          <input class="inp" type="number" step="0.1" min="1" [placeholder]="'Goal (' + unit + ')'" [(ngModel)]="goalInput">
          <button class="btn primary" (click)="saveGoal()">Save</button>
          <button class="btn ghost" (click)="editingGoal=false">Cancel</button>
        } @else {
          <span>Goal: <b>{{ goalKg != null ? (display(goalKg) | number:'1.1-1') + ' ' + unit : '—' }}</b></span>
          <span class="link" (click)="startEditGoal()">{{ goalKg != null ? 'Change' : 'Set goal' }}</span>
        }
      </div>

      @if (error) { <div class="err">{{ error }}</div> }
    </div>
  `,
})
export class WeightCardComponent implements OnInit {
  @Input() userId = '';

  entries: WeightEntry[] = [];
  goalKg: number | null = null;
  unit: 'kg' | 'lb' = 'kg';
  input: number | null = null;
  goalInput: number | null = null;
  editingGoal = false;
  loading = false;
  error = '';

  chartData: ChartData<'line'> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: false } },
  };

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    if (!this.userId) return;
    this.api.getWeight(this.userId).subscribe({
      next: h => { this.entries = h.entries; this.goalKg = h.goalKg; this.rebuildChart(); },
      error: () => { this.error = 'Could not load weight history.'; },
    });
  }

  display(kg: number): number { return this.unit === 'lb' ? kg * LB_PER_KG : kg; }
  private toKg(v: number): number { return this.unit === 'lb' ? v / LB_PER_KG : v; }

  setUnit(u: 'kg' | 'lb'): void { this.unit = u; this.rebuildChart(); }

  get currentKg(): number { return this.entries.length ? this.entries[this.entries.length - 1].weightKg : 0; }

  // Backend upserts "today" by UTC date (WeightService.UpsertTodayAsync), so compare
  // against the same UTC-dated string to correctly detect a same-day entry.
  get loggedToday(): boolean {
    if (!this.entries.length) return false;
    const todayUtc = new Date().toISOString().slice(0, 10);
    return this.entries[this.entries.length - 1].date === todayUtc;
  }

  private get monthAgoStartKg(): number {
    // earliest entry within the last ~30 days (fallback to the first entry)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recent = this.entries.filter(e => new Date(e.date) >= cutoff);
    const pool = recent.length ? recent : this.entries;
    return pool.length ? pool[0].weightKg : this.currentKg;
  }

  get changeClass(): string {
    const d = this.currentKg - this.monthAgoStartKg;
    return d < -0.05 ? 'down' : d > 0.05 ? 'up' : 'flat';
  }

  get changeLabel(): string {
    const d = this.display(this.currentKg) - this.display(this.monthAgoStartKg);
    if (Math.abs(d) < 0.05) return '— this month';
    const arrow = d < 0 ? '↓' : '↑';
    return `${arrow} ${Math.abs(d).toFixed(1)} ${this.unit} this month`;
  }

  get toGoLabel(): string {
    if (this.goalKg == null) return '';
    const d = this.display(this.currentKg) - this.display(this.goalKg);
    if (Math.abs(d) < 0.05) return 'goal reached 🎉';
    return `${Math.abs(d).toFixed(1)} ${this.unit} to go`;
  }

  private rebuildChart(): void {
    const labels = this.entries.map(e => formatLabel(e.date));
    const datasets: ChartData<'line'>['datasets'] = [{
      data: this.entries.map(e => round1(this.display(e.weightKg))),
      label: 'Weight',
      borderColor: '#2E6BE6',
      backgroundColor: 'rgba(46,107,230,.12)',
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: '#2E6BE6',
    }];
    if (this.goalKg != null && this.entries.length) {
      const goalVal = round1(this.display(this.goalKg));
      datasets.push({
        data: this.entries.map(() => goalVal),
        label: 'Goal',
        borderColor: '#9ECF10',
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
      });
    }
    this.chartData = { labels, datasets };
  }

  log(): void {
    if (!this.input || this.input <= 0) { this.error = 'Enter a valid weight.'; return; }
    this.loading = true; this.error = '';
    this.api.logWeight(this.userId, round1(this.toKg(this.input))).subscribe({
      next: () => { this.input = null; this.loading = false; this.snackBar.open('Weight logged.', '', { duration: 2000 }); this.load(); },
      error: () => { this.loading = false; this.error = 'Failed to log. Try again.'; },
    });
  }

  startEditGoal(): void {
    this.goalInput = this.goalKg != null ? round1(this.display(this.goalKg)) : null;
    this.editingGoal = true;
  }

  saveGoal(): void {
    if (!this.goalInput || this.goalInput <= 0) { this.error = 'Enter a valid goal.'; return; }
    this.api.setWeightGoal(this.userId, round1(this.toKg(this.goalInput))).subscribe({
      next: () => { this.editingGoal = false; this.load(); },
      error: () => { this.error = 'Failed to save goal. Try again.'; },
    });
  }
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function formatLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
