import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { LeaderboardEntry } from '../shared/models/leaderboard.model';
import { IconComponent } from '../shared/components/icon/icon.component';


@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, IconComponent],
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
    .list-header { display: grid; grid-template-columns: 52px 1fr 120px 80px 110px; gap: 0; padding: 12px 20px 10px; border-bottom: 1px solid #EAEEF6; }
    .list-header span { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .14em; color: #8592ad; }

    .list-row {
      display: grid; grid-template-columns: 52px 1fr 120px 80px 110px; gap: 0;
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

    .rival-btn {
      justify-self: end; border: 1px solid #d6e0ee; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: .06em;
      color: #5c6881; background: #fff; padding: 7px 12px; border-radius: 8px; transition: opacity .15s;
    }
    .rival-btn:hover { opacity: .8; }
    .rival-btn.active { color: #fff; background: linear-gradient(150deg,#2E6BE6,#1B47AE); border-color: transparent; }

    /* avatar thumbnails */
    .av-thumb, .av-initial {
      display:inline-block; border-radius:50%; object-fit:cover; vertical-align:middle; flex-shrink:0;
    }
    .av-thumb  { }
    .av-initial {
      background:#2E6BE6; color:#fff;
      font-family:'Chakra Petch',sans-serif; font-weight:700;
      display:inline-flex; align-items:center; justify-content:center;
    }
    /* list row size */
    .av-thumb.sm, .av-initial.sm { width:32px; height:32px; font-size:13px; }
    /* podium size */
    .av-thumb.lg, .av-initial.lg { width:48px; height:48px; font-size:20px; margin-bottom:6px; }

    /* prestige badge overlay */
    .av-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
    .prestige-badge {
      position: absolute; top: -4px; right: -4px;
      display: inline-flex; align-items: center; justify-content: center;
      font-family: 'Chakra Petch', sans-serif; font-weight: 800; line-height: 1;
      color: #fff; background: linear-gradient(150deg,#FFD24A,#F5A200);
      border: 1.5px solid #fff; border-radius: 999px;
      box-shadow: 0 2px 6px -1px rgba(180,120,0,.6);
      white-space: nowrap;
    }
    /* list-row (sm) size */
    .av-wrap.sm .prestige-badge { font-size: 9px; padding: 1px 4px; min-width: 15px; height: 15px; }
    /* podium (lg) size */
    .av-wrap.lg .prestige-badge { font-size: 11px; padding: 1px 5px; min-width: 18px; height: 18px; top: -5px; right: -5px; }
  `],
  template: `
    <div class="page">
      <div class="lb-header"><app-icon name="trophy" [size]="22" /> LEADERBOARD</div>

      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading">
        <!-- Podium top 3 -->
        <div class="podium" *ngIf="entries.length >= 3">
          <!-- 2nd place (left) -->
          <div class="podium-slot" (click)="viewProfile(entries[1])">
            <div class="podium-card" [style.background]="'#F7F7F7'">
              <span class="av-wrap lg">
                @if (entries[1].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[1].activeAvatarImagePath" [alt]="entries[1].firstName"
                       [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[1].firstName[0] }}</span>
                }
                @if (entries[1].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[1].prestigeLevel }}</span>
                }
              </span>
              <div class="podium-name">{{ entries[1].firstName }} {{ entries[1].lastName }}</div>
              <div class="podium-pts">{{ entries[1].totalPoints | number }}</div>
            </div>
            <div class="podium-bar" [style.height.px]="90" [style.background]="'#E0E0E0'">2</div>
          </div>
          <!-- 1st place (center) -->
          <div class="podium-slot" (click)="viewProfile(entries[0])">
            <div class="podium-card" style="background: linear-gradient(150deg,#FFE27A,#FFC200); box-shadow: 0 0 28px rgba(255,194,0,.5);">
              <app-icon name="crown" [size]="34" style="color:#fff;" />
              <span class="av-wrap lg">
                @if (entries[0].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[0].activeAvatarImagePath" [alt]="entries[0].firstName"
                       [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[0].firstName[0] }}</span>
                }
                @if (entries[0].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[0].prestigeLevel }}</span>
                }
              </span>
              <div class="podium-name">{{ entries[0].firstName }} {{ entries[0].lastName }}</div>
              <div class="podium-pts">{{ entries[0].totalPoints | number }}</div>
            </div>
            <div class="podium-bar" [style.height.px]="120" [style.background]="'#FFD700'">1</div>
          </div>
          <!-- 3rd place (right) -->
          <div class="podium-slot" (click)="viewProfile(entries[2])">
            <div class="podium-card" [style.background]="'#FDF0E6'">
              <span class="av-wrap lg">
                @if (entries[2].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[2].activeAvatarImagePath" [alt]="entries[2].firstName"
                       [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[2].firstName[0] }}</span>
                }
                @if (entries[2].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[2].prestigeLevel }}</span>
                }
              </span>
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
            <span></span>
          </div>
          <div class="list-row"
               *ngFor="let e of entries; let i = index"
               [class.top3]="i < 3 && !isMe(e)"
               [class.me]="isMe(e)"
               (click)="viewProfile(e)">
            <div>
              <span class="rank-chip" [class]="rankChipClass(i, e)">{{ e.rank }}</span>
            </div>
            <div class="athlete-name">
              <span class="av-wrap sm">
                @if (e.activeAvatarImagePath) {
                  <img class="av-thumb sm" [src]="e.activeAvatarImagePath" [alt]="e.firstName"
                       [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial sm" [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ e.firstName[0] }}</span>
                }
                @if (e.prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ e.prestigeLevel }}</span>
                }
              </span>
              {{ e.firstName }} {{ e.lastName }}
              <span class="you-badge" *ngIf="isMe(e)">YOU</span>
            </div>
            <div class="pts-val" [class.me]="isMe(e)">{{ e.totalPoints | number }}</div>
            <div class="trend" [class]="trendClass(e.rankTrend)">{{ trendLabel(e.rankTrend) }}</div>
            <div>
              @if (!isMe(e)) {
                <button class="rival-btn" [class.active]="e.userId === myRivalUserId"
                        (click)="toggleRival(e, $event)">
                  {{ e.userId === myRivalUserId ? 'YOUR RIVAL' : 'RIVAL' }}
                </button>
              }
            </div>
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
  myRivalUserId: string | null = null;

  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.api.getLeaderboard().subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load leaderboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
    if (this.myId) {
      this.api.getRival(this.myId).subscribe({
        next: r => { this.myRivalUserId = r.rivalUserId; },
        error: () => {},
      });
    }
  }

  isMe(e: LeaderboardEntry) { return e.userId === this.myId; }

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

  viewProfile(entry: LeaderboardEntry) {
    this.router.navigate(['/profile', entry.userId]);
  }

  toggleRival(e: LeaderboardEntry, event: Event): void {
    event.stopPropagation();
    if (!this.myId) return;

    if (e.userId === this.myRivalUserId) {
      this.api.clearRival(this.myId).subscribe({
        next: () => {
          this.myRivalUserId = null;
          this.snackBar.open('Rival cleared.', '', { duration: 2500 });
        },
      });
    } else {
      this.api.setRival(this.myId, e.userId).subscribe({
        next: () => {
          this.myRivalUserId = e.userId;
          this.snackBar.open(`${e.firstName} is now your rival!`, '', { duration: 2500 });
        },
        error: () => {
          this.snackBar.open('Failed to set rival. Please try again.', 'OK', { duration: 4000 });
        },
      });
    }
  }
}
