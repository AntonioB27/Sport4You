import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, ActivityItem } from '../shared/models/dashboard.model';

const SPORT_COLORS: Record<string, string> = {
  running: '#ef5350',
  walking: '#42a5f5',
  cycling: '#66bb6a',
  swimming: '#26c6da',
  gym: '#ab47bc',
  daily_steps: '#ffa726',
};

const SPORT_ICONS: Record<string, string> = {
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  swimming: '🏊',
  gym: '🏋️',
  daily_steps: '👟',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
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
          <!-- Line chart: points over time -->
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

          <!-- Doughnut chart: sport breakdown -->
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

  constructor(private api: ApiService) {}

  ngOnInit() {
    const userId =
      localStorage.getItem('viewingUserId') ?? localStorage.getItem('userId');
    localStorage.removeItem('viewingUserId');

    if (!userId) { this.loading = false; return; }

    this.api.getDashboard(userId).subscribe({
      next: data => {
        this.data = data;
        this.streak = this.calculateStreak(data.activities);
        this.buildLineChart(data);
        this.buildDoughnutChart(data);
        this.loading = false;
      },
      error: () => { this.loading = false; },
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
    if (a.duration != null) return `${a.duration} min`;
    if (a.steps != null) return `${a.steps.toLocaleString()} steps`;
    return '';
  }
}
