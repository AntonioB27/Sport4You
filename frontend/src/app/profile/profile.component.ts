import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, AchievementStatus, AvatarStatus } from '../shared/models/dashboard.model';
import { achievementIconPath } from '../shared/utils/achievement-icon';
import { AvatarLockerComponent } from './avatar-locker.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatSnackBarModule, AvatarLockerComponent],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 680px; margin: 0 auto; }
    .page.wide { max-width: 1160px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }
    .error-state { text-align: center; padding: 80px 0; }
    .error-msg { font-family: 'Chakra Petch', sans-serif; font-size: 20px; color: #10203E; margin-bottom: 16px; }
    .back-link { font-family: 'Chakra Petch', sans-serif; font-size: 13px; color: #2E6BE6; text-decoration: none; }

    /* Tab bar */
    .tab-bar { display: flex; gap: 4px; background: #F4F6FB; border-radius: 14px; padding: 4px; margin-bottom: 20px; }
    .tab {
      flex: 1; padding: 10px; border: none; border-radius: 10px; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .06em;
      color: #8592ad; background: transparent; transition: background .15s, color .15s;
    }
    .tab.active { background: #fff; color: #10203E; box-shadow: 0 2px 8px -4px rgba(46,107,230,.2); }

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

  `],
  template: `
    <div class="page" [class.wide]="activeTab === 'avatars' && isOwnProfile">
      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (error) {
        <div class="error-state">
          <div class="error-msg">User not found.</div>
          <a class="back-link" routerLink="/leaderboard">← Back to Leaderboard</a>
        </div>
      } @else if (data) {

        @if (isOwnProfile) {
          <div class="tab-bar">
            <button class="tab" [class.active]="activeTab === 'overview'" (click)="selectTab('overview')">OVERVIEW</button>
            <button class="tab" [class.active]="activeTab === 'avatars'" (click)="selectTab('avatars')">
              AVATARS ({{ avatarsLoaded ? unlockedCount + '/' + avatars.length : '…' }})
            </button>
          </div>
        }

        @if (activeTab === 'overview') {
          <div class="hero-card">
            @if (data.activeAvatar) {
              <img class="hero-av" [src]="data.activeAvatar.imagePath" [alt]="data.activeAvatar.name">
            } @else {
              <span class="hero-initial">{{ data.user.firstName[0] }}</span>
            }
            <div class="hero-name">{{ data.user.firstName }} {{ data.user.lastName }}</div>
            <div class="level-badge">Lv. {{ data.xp.level }} · {{ data.xp.levelTitle }}</div>
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

        @if (activeTab === 'avatars' && isOwnProfile) {
          @if (avatarsLoading) {
            <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
          } @else {
            <app-avatar-locker [avatars]="avatars" [equipping]="equipping" (equip)="equip($event)"></app-avatar-locker>
          }
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

  activeTab: 'overview' | 'avatars' = 'overview';

  avatars: AvatarStatus[] = [];
  avatarsLoading = false;
  avatarsLoaded = false;
  equipping = false;

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
        if (!this.isOwnProfile) this.loadAvatars();
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

  get unlockedCount(): number {
    return this.avatars.filter(a => a.unlocked).length;
  }

  iconPath(a: AchievementStatus): string {
    return achievementIconPath(a);
  }

  selectTab(tab: 'overview' | 'avatars'): void {
    this.activeTab = tab;
    if (tab === 'avatars' && !this.avatarsLoaded) this.loadAvatars();
  }

  private loadAvatars(): void {
    this.avatarsLoading = true;
    this.api.getAvatars(this.userId).subscribe({
      next: list => { this.avatars = list; this.avatarsLoading = false; this.avatarsLoaded = true; },
      error: () => { this.avatarsLoading = false; },
    });
  }

  equip(avatar: AvatarStatus): void {
    if (avatar.isActive) return;
    this.equipping = true;
    this.api.setActiveAvatar(this.userId, avatar.id).subscribe({
      next: () => {
        this.avatars = this.avatars.map(a => ({ ...a, isActive: a.id === avatar.id }));
        this.equipping = false;
        this.snackBar.open(`${avatar.name} equipped!`, '', { duration: 2500 });
      },
      error: () => { this.equipping = false; this.snackBar.open('Failed to equip avatar. Please try again.', 'OK', { duration: 4000 }); },
    });
  }
}
