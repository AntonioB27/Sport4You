import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

// Fixed axis order for the radar/spider chart. Every user is plotted against
// the same six spokes so the web shape is consistent and comparable across
// profiles, even when some sports have zero points.
const RADAR_SPORTS = ['running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps'];

export function formatSport(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Aligns the sparse per-sport breakdown to the fixed radar axis order,
// zero-filling any sport the user hasn't logged.
export function radarValues(
  series: { sport: string; points: number }[], order: string[],
): number[] {
  const map = new Map(series.map(s => [s.sport, s.points]));
  return order.map(s => map.get(s) ?? 0);
}

@Component({
  selector: 'app-sport-radar',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  styles: [`
    :host { display:block; }
    .chart-wrap { position:relative; height:220px; }
    .empty { color:#8592ad; font-family:'Nunito',sans-serif; font-size:13px; padding:28px 0; text-align:center; }
  `],
  template: `
    @if (hasData) {
      <div class="chart-wrap">
        <canvas baseChart [type]="'radar'" [data]="radarData" [options]="radarOptions"></canvas>
      </div>
    } @else {
      <div class="empty">No sport data yet.</div>
    }
  `,
})
export class SportRadarComponent implements OnChanges {
  @Input() sportBreakdown: { sport: string; points: number }[] = [];

  hasData = false;

  radarData: ChartData<'radar'> = { labels: [], datasets: [] };
  radarOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        ticks: { display: false, precision: 0 },
        pointLabels: { font: { size: 11, family: 'Chakra Petch, sans-serif' } },
      },
    },
  };

  ngOnChanges(): void {
    const values = radarValues(this.sportBreakdown ?? [], RADAR_SPORTS);
    this.hasData = values.some(v => v > 0);
    this.radarData = {
      labels: RADAR_SPORTS.map(formatSport),
      datasets: [{
        data: values,
        label: 'Points',
        backgroundColor: 'rgba(46,107,230,.18)',
        borderColor: '#2E6BE6',
        pointBackgroundColor: '#2E6BE6',
        pointRadius: 3,
      }],
    };
  }
}
