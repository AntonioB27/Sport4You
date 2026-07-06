import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, AchievementStatus, AvatarStatus } from '../shared/models/dashboard.model';
import { achievementIconPath } from '../shared/utils/achievement-icon';
import { ContributionHeatmapComponent } from './contribution-heatmap/contribution-heatmap.component';
import { PersonalRecordsComponent } from './personal-records/personal-records.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatSnackBarModule, ContributionHeatmapComponent, PersonalRecordsComponent],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 680px; margin: 0 auto; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }
    .error-state { text-align: center; padding: 80px 0; }
    .error-msg { font-family: 'Chakra Petch', sans-serif; font-size: 20px; color: #10203E; margin-bottom: 16px; }
    .back-link { font-family: 'Chakra Petch', sans-serif; font-size: 13px; color: #2E6BE6; text-decoration: none; }

    /* Hero card */
    .hero-card {
      background: #fff; border-radius: 24px; border: 1px solid #E3EAF5;
      padding: 32px 24px 24px; text-align: center; margin-bottom: 18px;
    }
    .hero-av {
      width: 120px; height: 120px; border-radius: 50%; object-fit: cover;
      border: 3px solid #2E6BE6; box-shadow: 0 0 28px rgba(46,107,230,.3);
      margin-bottom: 14px;
    }
    .hero-initial {
      width: 120px; height: 120px; border-radius: 50%;
      background: #2E6BE6; color: #fff;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 44px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 3px solid #2E6BE6; box-shadow: 0 0 28px rgba(46,107,230,.3);
      margin-bottom: 14px;
    }
    .hero-name { font-family: 'Chakra Petch', sans-serif; font-size: 26px; font-weight: 700; color: #10203E; margin-bottom: 8px; }
    .level-badge {
      display: inline-block; background: #2E6BE6; color: #fff;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: .1em;
      padding: 5px 14px; border-radius: 999px; margin-bottom: 20px;
    }
    .stats-row { display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-chip {
      display: flex; flex-direction: column; align-items: center;
      background: #F4F6FB; border-radius: 12px; padding: 10px 20px; min-width: 80px;
    }
    .stat-label { font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .15em; color: #8592ad; margin-bottom: 3px; }
    .stat-val { font-family: 'Chakra Petch', sans-serif; font-size: 20px; font-weight: 700; color: #10203E; }

    /* XP bar */
    .xp-bar-wrap { margin-top: 4px; }
    .xp-bar-track { height: 6px; border-radius: 999px; background: #E3EAF5; overflow: hidden; margin-bottom: 5px; }
    .xp-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2E6BE6, #C6E63B); transition: width .4s; }
    .xp-label { font-size: 11px; color: #9aa6bd; text-align: right; }

    /* Sections */
    .section { background: #fff; border-radius: 20px; border: 1px solid #E3EAF5; padding: 20px; margin-bottom: 18px; }
    .section-title { font-family: 'Chakra Petch', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .15em; color: #8592ad; margin-bottom: 14px; }
    .empty-state { font-size: 13px; color: #b0bcd4; }

    /* Achievement chips */
    .ach-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .ach-chip { display: flex; align-items: center; gap: 8px; background: #F4F6FB; border-radius: 999px; padding: 6px 12px 6px 8px; }
    .ach-icon { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    .ach-name { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; color: #10203E; }

    /* Earned avatars showcase (public view) */
    .av-showcase-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .av-showcase-thumb { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #E3EAF5; }

    /* Rival button */
    .equip-btn {
      border: none; border-radius: 8px; padding: 6px 14px; cursor: pointer;
      background: #2E6BE6; color: #fff; font-family: 'Chakra Petch', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: .06em;
    }
    .equip-btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
  template: `
    <div class="page">
      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (error) {
        <div class="error-state">
          <div class="error-msg">User not found.</div>
          <a class="back-link" routerLink="/leaderboard">← Back to Leaderboard</a>
        </div>
      } @else if (data) {
        <div class="hero-card">
          @if (data.activeAvatar) {
            <img class="hero-av" [style.border]="data.activeBorderCss ?? '3px solid #2E6BE6'" [src]="data.activeAvatar.imagePath" [alt]="data.activeAvatar.name">
          } @else {
            <span class="hero-initial">{{ data.user.firstName[0] }}</span>
          }
          <div class="hero-name">{{ data.user.firstName }} {{ data.user.lastName }}</div>
          <div class="level-badge">
            @if (data.xp.prestigeLevel > 0) {
              <span style="font-weight:800; margin-right:4px;">★{{ data.xp.prestigeLevel }}</span>
            }
            Lv. {{ data.xp.level }} · {{ data.xp.levelTitle }}
          </div>
          @if (!isOwnProfile) {
            <button class="equip-btn" style="width:auto; padding:8px 18px; margin-bottom:16px;"
                    (click)="toggleRival()">
              {{ userId === myRivalUserId ? '✓ YOUR RIVAL' : 'SET AS RIVAL' }}
            </button>
          }
          <div class="stats-row">
            <div class="stat-chip">
              <span class="stat-label">RANK</span>
              <span class="stat-val">{{ data.rank > 0 ? '#' + data.rank : '—' }}</span>
            </div>
            <div class="stat-chip">
              <span class="stat-label">POINTS</span>
              <span class="stat-val">{{ data.totalPoints | number }}</span>
            </div>
            <div class="stat-chip">
              <span class="stat-label">STREAK</span>
              <span class="stat-val">{{ data.currentStreak }}d</span>
            </div>
          </div>
          <div class="xp-bar-wrap">
            <div class="xp-bar-track">
              <div class="xp-bar-fill" [style.width.%]="data.xp.xpPercent"></div>
            </div>
            <div class="xp-label">{{ data.xp.xpInLevel }} / {{ data.xp.xpForNextLevel }} XP</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">ACTIVITY</div>
          <app-contribution-heatmap [pointsOverTime]="data.pointsOverTime"></app-contribution-heatmap>
        </div>

        <div class="section">
          <div class="section-title">ACHIEVEMENTS</div>
          @if (earnedAchievements.length === 0) {
            <div class="empty-state">No achievements yet.</div>
          } @else {
            <div class="ach-row">
              @for (a of earnedAchievements; track a.id) {
                <div class="ach-chip">
                  <img class="ach-icon" [src]="iconPath(a)" [alt]="a.name">
                  <span class="ach-name">{{ a.name }}</span>
                </div>
              }
            </div>
          }
        </div>

        @if (isOwnProfile) {
          <div class="section">
            <div class="section-title">RECORDS</div>
            <app-personal-records [userId]="userId"></app-personal-records>
          </div>
        }

        @if (!isOwnProfile && earnedAvatars.length > 0) {
          <div class="section">
            <div class="section-title">AVATARS</div>
            <div class="av-showcase-row">
              @for (a of earnedAvatars; track a.id) {
                <img class="av-showcase-thumb" [src]="a.imagePath" [alt]="a.name" [title]="a.name">
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  userId = '';
  data: DashboardData | null = null;
  loading = true;
  error = false;

  myRivalUserId: string | null = null;
  private myId = localStorage.getItem('userId') ?? '';

  /** Only loaded for other users' profiles, to show their earned-avatar showcase. */
  avatars: AvatarStatus[] = [];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') ?? '';
    if (!this.userId) { this.loading = false; this.error = true; return; }

    this.api.getDashboard(this.userId).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        if (!this.isOwnProfile) {
          this.loadAvatars();
          if (this.myId) {
            this.api.getRival(this.myId).subscribe({
              next: r => { this.myRivalUserId = r.rivalUserId; },
              error: () => {},
            });
          }
        }
      },
      error: () => { this.loading = false; this.error = true; },
    });
  }

  get isOwnProfile(): boolean {
    return this.userId === (localStorage.getItem('userId') ?? '');
  }

  get earnedAchievements(): AchievementStatus[] {
    return (this.data?.recentAchievements ?? []).filter(a => a.unlocked).slice(0, 6);
  }

  get earnedAvatars(): AvatarStatus[] {
    return this.avatars.filter(a => a.unlocked);
  }

  iconPath(a: AchievementStatus): string {
    return achievementIconPath(a);
  }

  private loadAvatars(): void {
    this.api.getAvatars(this.userId).subscribe({
      next: list => { this.avatars = list; },
      error: () => {},
    });
  }

  toggleRival(): void {
    if (!this.myId) return;
    if (this.userId === this.myRivalUserId) {
      this.api.clearRival(this.myId).subscribe({
        next: () => { this.myRivalUserId = null; this.snackBar.open('Rival cleared.', '', { duration: 2500 }); },
      });
    } else {
      this.api.setRival(this.myId, this.userId).subscribe({
        next: () => { this.myRivalUserId = this.userId; this.snackBar.open('Rival set!', '', { duration: 2500 }); },
        error: () => this.snackBar.open('Failed to set rival. Please try again.', 'OK', { duration: 4000 }),
      });
    }
  }
}
