import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { LeaderboardEntry } from '../shared/models/leaderboard.model';

const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const ATHLETE_EMOJIS = ['🚴', '🏊', '🏃', '🚶', '🏋️', '👟'];

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 860px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }

    /* ── Header ── */
    .lb-header { font-family: 'Chakra Petch', sans-serif; font-size: 27px; font-weight: 700; color: #10203E; margin-bottom: 24px; }

    /* ── Podium ── */
    .podium { display: flex; justify-content: center; align-items: flex-end; gap: 12px; margin-bottom: 28px; }
    .podium-slot { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
    .podium-slot:hover .podium-card { transform: translateY(-3px); }
    .podium-card {
      border-radius: 18px; padding: 16px 18px; text-align: center; min-width: 130px;
      box-shadow: 0 16px 32px -16px rgba(16,32,62,.45);
      transition: transform .15s;
    }
    .podium-emoji { font-size: 28px; line-height: 1; }
    .podium-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #10203E; margin: 6px 0 2px; }
    .podium-pts { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #10203E; }
    .podium-medal { font-size: 22px; }
    .podium-bar {
      border-radius: 10px 10px 0 0;
      width: 90px; display: flex; align-items: flex-end; justify-content: center;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 24px;
      color: rgba(0,0,0,.3); padding-bottom: 4px;
    }

    /* ── Ranked list ── */
    .list-card { background: #fff; border-radius: 20px; box-shadow: 0 12px 28px -16px rgba(16,32,62,.3); overflow: hidden; }
    .list-header { display: grid; grid-template-columns: 52px 1fr 120px 80px; gap: 0; padding: 12px 20px 10px; border-bottom: 1px solid #EAEEF6; }
    .list-header span { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .14em; color: #8592ad; }

    .list-row {
      display: grid; grid-template-columns: 52px 1fr 120px 80px; gap: 0;
      padding: 13px 20px; align-items: center; border-bottom: 1px solid #F4F6FB;
      cursor: pointer; transition: background .12s;
    }
    .list-row:last-child { border-bottom: none; }
    .list-row:hover { background: #F9FBFF; }
    .list-row.me { background: #F4FBE3; }
    .list-row.me:hover { background: #EDFAD3; }
    .list-row.top3 { background: #FDFAF0; }

    .rank-chip {
      width: 32px; height: 32px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px;
    }
    .rank-chip.gold { background: #FFF3C4; color: #B78A00; }
    .rank-chip.silver { background: #F0F0F0; color: #707070; }
    .rank-chip.bronze { background: #FDE8D8; color: #8B4513; }
    .rank-chip.default { background: #F0F3FA; color: #8592ad; }
    .rank-chip.me { background: #DFF0A3; color: #4a6100; }

    .athlete-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #10203E; display: flex; align-items: center; gap: 8px; }
    .athlete-name .you-badge { font-size: 10px; font-weight: 700; letter-spacing: .1em; background: #C6E63B; color: #4a6100; padding: 2px 7px; border-radius: 999px; }

    .pts-val { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; color: #10203E; }
    .pts-val.me { color: #4a6100; }

    .trend { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; text-align: right; }
    .trend.up { color: #4CAF50; }
    .trend.down { color: #f44336; }
    .trend.neutral { color: #b0b8cb; }
  `],
  template: `
    <div class="page">
      <div class="lb-header">🏆 LEADERBOARD</div>

      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading">
        <!-- Podium top 3 -->
        <div class="podium" *ngIf="entries.length >= 3">
          <!-- 2nd place (left) -->
          <div class="podium-slot" (click)="viewDashboard(entries[1])">
            <div class="podium-card" [style.background]="'#F7F7F7'">
              <div class="podium-emoji">{{ athleteEmoji(1) }}</div>
              <div class="podium-name">{{ entries[1].firstName }} {{ entries[1].lastName }}</div>
              <div class="podium-pts">{{ entries[1].totalPoints | number }}</div>
            </div>
            <div class="podium-bar" [style.height.px]="90" [style.background]="'#E0E0E0'">2</div>
          </div>
          <!-- 1st place (center) -->
          <div class="podium-slot" (click)="viewDashboard(entries[0])">
            <div class="podium-card" style="background: linear-gradient(150deg,#FFE27A,#FFC200); box-shadow: 0 0 28px rgba(255,194,0,.5);">
              <div style="font-size:34px">👑</div>
              <div class="podium-emoji" style="font-size:22px">{{ athleteEmoji(0) }}</div>
              <div class="podium-name">{{ entries[0].firstName }} {{ entries[0].lastName }}</div>
              <div class="podium-pts">{{ entries[0].totalPoints | number }}</div>
            </div>
            <div class="podium-bar" [style.height.px]="120" [style.background]="'#FFD700'">1</div>
          </div>
          <!-- 3rd place (right) -->
          <div class="podium-slot" (click)="viewDashboard(entries[2])">
            <div class="podium-card" [style.background]="'#FDF0E6'">
              <div class="podium-emoji">{{ athleteEmoji(2) }}</div>
              <div class="podium-name">{{ entries[2].firstName }} {{ entries[2].lastName }}</div>
              <div class="podium-pts">{{ entries[2].totalPoints | number }}</div>
            </div>
            <div class="podium-bar" [style.height.px]="70" [style.background]="'#CD7F32'">3</div>
          </div>
        </div>

        <!-- Full ranked list -->
        <div class="list-card">
          <div class="list-header">
            <span>RANK</span>
            <span>ATHLETE</span>
            <span>POINTS</span>
            <span style="text-align:right">7-DAY</span>
          </div>
          <div class="list-row"
               *ngFor="let e of entries; let i = index"
               [class.top3]="i < 3 && !isMe(e)"
               [class.me]="isMe(e)"
               (click)="viewDashboard(e)">
            <div>
              <span class="rank-chip" [class]="rankChipClass(i, e)">{{ e.rank }}</span>
            </div>
            <div class="athlete-name">
              {{ athleteEmoji(i) }} {{ e.firstName }} {{ e.lastName }}
              <span class="you-badge" *ngIf="isMe(e)">YOU</span>
            </div>
            <div class="pts-val" [class.me]="isMe(e)">{{ e.totalPoints | number }}</div>
            <div class="trend" [class]="trendClass(e.rankTrend)">{{ trendLabel(e.rankTrend) }}</div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  entries: LeaderboardEntry[] = [];
  loading = true;
  private myId = localStorage.getItem('userId') ?? '';

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

  isMe(e: LeaderboardEntry) { return e.userId === this.myId; }

  athleteEmoji(i: number) { return ATHLETE_EMOJIS[i % ATHLETE_EMOJIS.length]; }

  rankChipClass(i: number, e: LeaderboardEntry): string {
    if (this.isMe(e)) return 'me';
    if (i === 0) return 'gold';
    if (i === 1) return 'silver';
    if (i === 2) return 'bronze';
    return 'default';
  }

  trendClass(trend: number): string {
    if (trend > 0) return 'up';
    if (trend < 0) return 'down';
    return 'neutral';
  }

  trendLabel(trend: number): string {
    if (trend > 0) return `↑ ${trend}`;
    if (trend < 0) return `↓ ${Math.abs(trend)}`;
    return '—';
  }

  viewDashboard(entry: LeaderboardEntry) {
    localStorage.setItem('viewingUserId', entry.userId);
    this.router.navigate(['/dashboard']);
  }
}
