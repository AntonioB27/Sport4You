import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SportRadarComponent } from '../../shared/components/sport-radar/sport-radar.component';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;

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

function barLabel(key: string): string {
  return new Date(key + 'T00:00:00Z')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, SportRadarComponent],
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
    /* auto-fit so a lone chart (e.g. a lapsed user with all-time sport mix but
       no activity in the 14-day volume window) fills the row instead of leaving
       a blank half-column. */
    .row { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:20px; }
    .chart-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.14em; color:#8592ad; margin-bottom:8px; }
    .chart-wrap { position:relative; height:200px; }
    .empty { color:#8592ad; font-family:'Nunito',sans-serif; font-size:13px; padding:28px 0; text-align:center; }
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
              <app-sport-radar [sportBreakdown]="sportBreakdown"></app-sport-radar>
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

  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  ngOnChanges(): void {
    this.hasBreakdown = (this.sportBreakdown ?? []).some(s => s.points > 0);

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
