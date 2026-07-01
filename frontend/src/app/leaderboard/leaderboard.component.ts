import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { LeaderboardEntry } from '../shared/models/leaderboard.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  styles: [`
    .container { max-width: 800px; margin: 32px auto; padding: 0 16px; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
    .trend-up { color: #4caf50; font-weight: 600; }
    .trend-down { color: #f44336; font-weight: 600; }
    .trend-neutral { color: #9e9e9e; }
    .rank-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      background: #e3f2fd; font-weight: 700;
    }
    .rank-1 { background: #ffd700; color: #333; }
    .rank-2 { background: #c0c0c0; color: #333; }
    .rank-3 { background: #cd7f32; color: white; }
    .name-link { cursor: pointer; color: #1976d2; text-decoration: underline; }
    table { width: 100%; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
  `],
  template: `
    <div class="container">
      <div class="title">🏆 Global Leaderboard</div>

      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48" />
      </div>

      <mat-card *ngIf="!loading">
        <table mat-table [dataSource]="entries">

          <ng-container matColumnDef="rank">
            <th mat-header-cell *matHeaderCellDef>Rank</th>
            <td mat-cell *matCellDef="let e">
              <span class="rank-badge" [class]="'rank-' + e.rank">{{ e.rank }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Athlete</th>
            <td mat-cell *matCellDef="let e">
              <span class="name-link" (click)="viewDashboard(e)">
                {{ e.firstName }} {{ e.lastName }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="points">
            <th mat-header-cell *matHeaderCellDef>Total Points</th>
            <td mat-cell *matCellDef="let e">
              <strong>{{ e.totalPoints | number }}</strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="trend">
            <th mat-header-cell *matHeaderCellDef>7-Day Trend</th>
            <td mat-cell *matCellDef="let e">
              <span [class]="getTrendClass(e.rankTrend)">
                {{ getTrendLabel(e.rankTrend) }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </mat-card>
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  entries: LeaderboardEntry[] = [];
  columns = ['rank', 'name', 'points', 'trend'];
  loading = true;

  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.api.getLeaderboard().subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load leaderboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  viewDashboard(entry: LeaderboardEntry) {
    localStorage.setItem('viewingUserId', entry.userId);
    this.router.navigate(['/dashboard']);
  }

  getTrendClass(trend: number): string {
    if (trend > 0) return 'trend-up';
    if (trend < 0) return 'trend-down';
    return 'trend-neutral';
  }

  getTrendLabel(trend: number): string {
    if (trend > 0) return `↑ ${trend}`;
    if (trend < 0) return `↓ ${Math.abs(trend)}`;
    return '—';
  }
}
