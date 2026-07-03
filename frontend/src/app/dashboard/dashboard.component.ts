import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { ActivityLoggedService } from '../shared/services/activity-logged.service';
import { UserStateService } from '../shared/services/user-state.service';
import { DashboardData, ActivityItem, DailyMissionItem } from '../shared/models/dashboard.model';
import { SPORT_COLORS, SPORT_ICONS } from '../shared/constants/sport.constants';
import { LogActivityDialogComponent } from '../shared/components/log-activity-dialog/log-activity-dialog.component';
import { RegisterDialogComponent } from '../shared/components/register-dialog/register-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, RouterLink],
  styles: [`
    @keyframes floaty { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-10px) rotate(2deg); } }
    @keyframes glowpulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }

    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 1100px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }

    /* ── Header ── */
    .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
    .welcome-label { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .18em; color: #8592ad; }
    .welcome-name { font-family: 'Chakra Petch', sans-serif; font-size: 27px; font-weight: 700; color: #10203E; line-height: 1.05; }
    .top-badges { display: flex; align-items: center; gap: 12px; }
    .streak-badge {
      display: flex; align-items: center; gap: 7px; background: #fff;
      border: 1px solid #ffe0cf; padding: 8px 14px; border-radius: 999px;
      box-shadow: 0 8px 18px -10px rgba(255,122,0,.5);
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; color: #FF6A00; font-size: 14px;
    }
    .coins-badge {
      display: flex; align-items: center; gap: 7px; background: #fff;
      border: 1px solid rgba(158,207,16,.6); padding: 8px 14px; border-radius: 999px;
      box-shadow: 0 8px 18px -10px rgba(158,207,16,.5);
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; color: #5f7a00; font-size: 14px;
    }

    /* ── Grid ── */
    .grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

    .col { display: flex; flex-direction: column; gap: 18px; }

    /* ── Hero card ── */
    .hero-card {
      position: relative; border-radius: 22px; padding: 22px 24px;
      background: linear-gradient(150deg, #2E6BE6, #173B92);
      box-shadow: 0 20px 40px -18px rgba(30,79,184,.7); min-height: 200px;
    }
    .hero-mascot {
      position: absolute; right: 10px; bottom: 0; width: 160px; height: 190px;
    }
    .hero-mascot-shadow {
      position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);
      width: 100px; height: 20px; border-radius: 50%;
      background: radial-gradient(closest-side, rgba(198,230,59,.5), transparent);
      filter: blur(5px);
    }
    .hero-mascot img {
      position: relative; width: 100%; height: 100%; object-fit: contain;
      filter: drop-shadow(0 10px 14px rgba(0,0,0,.3));
      animation: floaty 4s ease-in-out infinite;
    }
    .level-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,.14); border: 1px solid rgba(198,230,59,.5);
      color: #C6E63B; font-family: 'Chakra Petch', sans-serif; font-weight: 700;
      font-size: 12px; letter-spacing: .14em; padding: 5px 12px; border-radius: 999px;
    }
    .hero-points {
      font-family: 'Chakra Petch', sans-serif; font-size: 46px; font-weight: 700;
      color: #fff; line-height: 1; margin: 14px 0 2px; text-shadow: 0 0 20px rgba(46,107,230,.5);
    }
    .hero-pts-label {
      font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700;
      letter-spacing: .18em; color: #bcd2ff; margin-bottom: 16px;
    }
    .xp-meta { display: flex; justify-content: space-between; max-width: 62%; font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; color: #dbe8ff; margin-bottom: 6px; }
    .xp-meta span:last-child { color: #8fb0ee; }
    .xp-bar { height: 12px; border-radius: 999px; background: rgba(0,0,0,.24); max-width: 62%; overflow: hidden; }
    .xp-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 16px rgba(198,230,59,.95); }

    /* ── Stat tiles ── */
    .stat-tiles { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .stat-tile { background: #fff; border-radius: 16px; padding: 15px 16px; box-shadow: 0 10px 22px -14px rgba(16,32,62,.35); }
    .stat-label { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .14em; color: #8592ad; }
    .stat-value { font-family: 'Chakra Petch', sans-serif; font-size: 26px; font-weight: 700; color: #10203E; }
    .stat-value.blue { color: #2E6BE6; }

    /* ── Cards ── */
    .card { background: #fff; border-radius: 18px; padding: 18px 20px; box-shadow: 0 12px 26px -16px rgba(16,32,62,.35); }
    .card-title { font-family: 'Chakra Petch', sans-serif; font-size: 16px; font-weight: 700; color: #10203E; letter-spacing: .04em; margin-bottom: 14px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-sub { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; color: #8592ad; }

    /* ── Quests ── */
    .quest-list { display: flex; flex-direction: column; gap: 11px; }
    .quest-item { display: flex; align-items: center; gap: 13px; }
    .quest-icon { width: 40px; height: 40px; border-radius: 12px; background: #EAF7C9; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .quest-icon.done { background: linear-gradient(150deg,#C6E63B,#9ECF10); }
    .quest-body { flex: 1; }
    .quest-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #10203E; }
    .quest-name.done-text { color: #4a6100; }
    .quest-done-label { font-family: 'Chakra Petch', sans-serif; font-size: 11px; letter-spacing: .12em; font-weight: 700; color: #7c9c00; margin-top: 2px; }
    .quest-bar { height: 7px; border-radius: 999px; background: #EAEEF6; margin-top: 6px; overflow: hidden; }
    .quest-bar-fill { height: 100%; border-radius: 999px; }
    .quest-bar-fill.green { background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 8px rgba(198,230,59,.8); }
    .quest-bar-fill.blue { background: #2E6BE6; box-shadow: 0 0 8px rgba(46,107,230,.7); }
    .quest-pts { font-family: 'Chakra Petch', sans-serif; font-size: 13px; font-weight: 700; color: #5f7a00; }

    /* ── Recent Achievements ── */
    .achievements-card { background:#fff; border-radius:18px; padding:18px 20px; border:1px solid #E3EAF5; }
    .achievements-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; }
    .achievements-see-all { font-size:11px; font-weight:700; color:#2E6BE6; letter-spacing:.05em; text-decoration:none; cursor:pointer; }
    .ach-row { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #F0F4FB; }
    .ach-row:last-child { border-bottom:none; }
    .ach-tier-strip { width:4px; height:36px; border-radius:2px; flex-shrink:0; }
    .ach-row-info { flex:1; min-width:0; }
    .ach-row-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#10203E; }
    .ach-row-desc { font-size:11px; color:#8592ad; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ach-row-date { font-size:11px; color:#b0bcd4; flex-shrink:0; }
    .ach-empty { font-size:13px; color:#b0bcd4; text-align:center; padding:12px 0; font-style:italic; }

    /* ── Leaderboard snippet ── */
    .lb-list { display: flex; flex-direction: column; gap: 9px; }
    .lb-row { display: flex; align-items: center; gap: 10px; padding: 2px 0; }
    .lb-row.me { background: #F4FBE3; border: 1px solid rgba(158,207,16,.6); border-radius: 12px; padding: 8px 10px; margin: 0 -6px; }
    .lb-rank { font-family: 'Chakra Petch', sans-serif; font-weight: 700; color: #c9a13a; width: 16px; }
    .lb-rank.me { color: #5f7a00; }
    .lb-rank.grey { color: #8592ad; }
    .lb-name { flex: 1; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #10203E; }
    .lb-pts { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #8592ad; }
    .lb-pts.me { color: #5f7a00; }
    .lb-link { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; color: #2E6BE6; }

    /* ── Activity feed ── */
    .activity-list { display: flex; flex-direction: column; gap: 12px; max-height: 240px; overflow-y: auto; }
    .activity-item { display: flex; align-items: center; gap: 11px; }
    .activity-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .activity-body { flex: 1; }
    .activity-sport { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #10203E; }
    .activity-meta { font-family: 'Chakra Petch', sans-serif; font-size: 11px; color: #8592ad; font-weight: 700; margin-top: 2px; }
    .activity-pts { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #2E6BE6; }

    /* ── Log button (desktop bottom of right col) ── */
    .log-card {
      text-align: center; background: linear-gradient(150deg,#C6E63B,#9ECF10);
      color: #10203E; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .05em;
      padding: 15px; border-radius: 16px; box-shadow: 0 0 26px rgba(198,230,59,.6), 0 5px 0 #7c9c00;
      cursor: pointer; border: none; width: 100%;
      transition: transform .1s, box-shadow .1s;
    }
    .log-card:hover { transform: translateY(-1px); box-shadow: 0 0 32px rgba(198,230,59,.7), 0 6px 0 #7c9c00; }
    .log-card:active { transform: translateY(1px); box-shadow: 0 0 18px rgba(198,230,59,.4), 0 3px 0 #7c9c00; }

    .empty { color: #999; padding: 16px 0; font-family: 'Chakra Petch', sans-serif; font-size: 13px; }
  `],
  template: `
    <div class="page">
      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading && data">
        <!-- Top bar -->
        <div class="top-bar">
          <div>
            <div class="welcome-label">WELCOME BACK</div>
            <div class="welcome-name">Hi, {{ data.user.firstName }} 👋</div>
          </div>
          <div class="top-badges">
            <div class="streak-badge" *ngIf="(data?.currentStreak ?? 0) > 0">🔥 {{ data!.currentStreak }} day streak</div>
            <div class="coins-badge">🪙 {{ data.totalPoints | number }}</div>
          </div>
        </div>

        <div class="grid">
          <!-- LEFT COLUMN -->
          <div class="col">
            <!-- Hero card -->
            <div class="hero-card">
              <div class="hero-mascot">
                <div class="hero-mascot-shadow"></div>
                <img [src]="data.activeAvatar?.imagePath ?? 'assets/sporty_wave.png'"
                     [alt]="data.activeAvatar?.name ?? 'Sporty'" />
              </div>
              <div class="level-badge">⚡ LEVEL {{ level }} · {{ levelTitle }}</div>
              <div class="hero-points">{{ data.totalPoints | number }}</div>
              <div class="hero-pts-label">TOTAL POINTS</div>
              <div class="xp-meta">
                <span>{{ xpInLevel }} XP</span>
                <span>{{ xpForNextLevel }} → LV {{ level + 1 }}</span>
              </div>
              <div class="xp-bar">
                <div class="xp-fill" [style.width.%]="xpPercent"></div>
              </div>
            </div>

            <!-- Stat tiles -->
            <div class="stat-tiles">
              <div class="stat-tile">
                <div class="stat-label">GLOBAL RANK</div>
                <div class="stat-value blue">{{ (data?.rank ?? 0) > 0 ? '#' + data!.rank : '—' }}</div>
              </div>
              <div class="stat-tile">
                <div class="stat-label">THIS WEEK</div>
                <div class="stat-value">{{ weeklyPoints | number }}</div>
              </div>
              <div class="stat-tile">
                <div class="stat-label">ACTIVITIES</div>
                <div class="stat-value">{{ data.activities.length }} 🎖️</div>
              </div>
            </div>

            <!-- Quests -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">TODAY'S QUESTS</span>
                <span class="card-sub">{{ missionsDone }} / {{ data?.dailyMissions?.length ?? 0 }} done</span>
              </div>
              <div class="quest-list">
                <div class="quest-item" *ngFor="let m of data?.dailyMissions">
                  <div class="quest-icon" [class.done]="m.completed">{{ m.completed ? '✓' : tierIcon(m.tier) }}</div>
                  <div class="quest-body">
                    <div class="quest-name" [class.done-text]="m.completed">{{ m.description }}</div>
                    <div class="quest-done-label" *ngIf="m.completed">COMPLETE</div>
                    <div class="quest-bar" *ngIf="!m.completed">
                      <div class="quest-bar-fill"
                           [class.green]="m.tier === 'easy'"
                           [class.blue]="m.tier === 'medium'"
                           [style.width.%]="progressPercent(m)"></div>
                    </div>
                  </div>
                  <div class="quest-pts">+{{ m.xpReward }} XP</div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN -->
          <div class="col">
            <!-- Leaderboard snippet -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">🏆 LEADERBOARD</span>
                <span class="lb-link">All time</span>
              </div>
              <div class="lb-list">
                <div *ngFor="let e of topEntries; let i = index"
                     class="lb-row" [class.me]="e.isMe">
                  <span class="lb-rank" [class.me]="e.isMe" [class.grey]="i > 0 && !e.isMe">{{ e.rank }}</span>
                  <span>{{ sportIconForUser(i) }}</span>
                  <span class="lb-name">{{ e.firstName }} {{ e.lastName }}{{ e.isMe ? ' (You)' : '' }}</span>
                  <span class="lb-pts" [class.me]="e.isMe">{{ e.totalPoints | number }}</span>
                </div>
              </div>
            </div>

            <!-- Recent activity -->
            <div class="card">
              <div class="card-title">RECENT ACTIVITY</div>
              <div class="activity-list">
                <div class="activity-item" *ngFor="let a of data.activities.slice(0, 6)">
                  <div class="activity-icon" [style.background]="sportBg(a.sport)">{{ sportIcon(a.sport) }}</div>
                  <div class="activity-body">
                    <div class="activity-sport">{{ formatSport(a.sport) }} · {{ formatMetric(a) }}</div>
                    <div class="activity-meta">{{ formatDate(a.dateTime) }}</div>
                  </div>
                  <div class="activity-pts">+{{ a.points }}</div>
                </div>
                <div class="empty" *ngIf="data.activities.length === 0">No activities yet — start logging!</div>
              </div>
            </div>

            <!-- Recent Achievements -->
            <div class="achievements-card">
              <div class="achievements-title">
                <span>🏅 RECENT ACHIEVEMENTS</span>
                <a class="achievements-see-all" routerLink="/achievements">SEE ALL →</a>
              </div>
              @if ((data?.recentAchievements?.length ?? 0) === 0) {
                <div class="ach-empty">No achievements yet — keep going!</div>
              } @else {
                @for (a of data!.recentAchievements; track a.id) {
                  <div class="ach-row">
                    <div class="ach-tier-strip" [style.background]="tierColor(a.tier)"></div>
                    <div class="ach-row-info">
                      <div class="ach-row-name">{{ a.name }}</div>
                      <div class="ach-row-desc">{{ a.description }}</div>
                    </div>
                    <div class="ach-row-date">{{ a.unlockedAt | date:'MMM d' }}</div>
                  </div>
                }
              }
            </div>

            <!-- Log Activity CTA -->
            <button class="log-card" (click)="openLogActivity()">+ LOG ACTIVITY</button>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading && !data">
        <div style="padding: 40px; font-family: 'Chakra Petch', sans-serif; color: #8592ad;">User not found.</div>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  weeklyPoints = 0;
  topEntries: any[] = [];
  private sub?: Subscription;

  // XP / level (from API data.xp)
  get level(): number { return this.data?.xp?.level ?? 1; }
  get levelTitle(): string { return this.data?.xp?.levelTitle ?? 'ROOKIE'; }
  get xpPercent(): number { return this.data?.xp?.xpPercent ?? 0; }
  get xpInLevel(): number { return this.data?.xp?.xpInLevel ?? 0; }
  get xpForNextLevel(): number { return this.data?.xp?.xpForNextLevel ?? 200; }

  get missionsDone(): number { return this.data?.dailyMissions?.filter(m => m.completed).length ?? 0; }

  readonly LEADERBOARD_ICONS = ['🚴', '🧃', '🏊', '🏋️', '🏃'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private activityLogged: ActivityLoggedService,
    private userState: UserStateService,
  ) {}

  ngOnInit() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loadData(userId);
    this.sub = this.activityLogged.activityLogged$.subscribe(() => this.loadData());
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  loadData(userId?: string) {
    const uid = userId ?? localStorage.getItem('userId');
    if (!uid) return;
    this.loading = true;
    this.api.getDashboard(uid).subscribe({
      next: data => {
        this.data = data;
        if (data.xp) {
          this.userState.setXp(data.xp);
        }
        this.weeklyPoints = data.pointsOverTime
          .filter(p => new Date(p.date) >= new Date(Date.now() - 7 * 86400000))
          .reduce((s, p) => s + p.points, 0);
        this.loading = false;
        this.loadLeaderboard(uid);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          localStorage.removeItem('userId');
          this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px' });
          return;
        }
        this.snackBar.open('Failed to load dashboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  private loadLeaderboard(myId: string) {
    this.api.getLeaderboard().subscribe({
      next: entries => {
        this.topEntries = entries.slice(0, 4).map(e => ({ ...e, isMe: e.userId === myId }));
      },
    });
  }

  tierIcon(tier: string): string {
    return tier === 'easy' ? '⭐' : tier === 'medium' ? '🏆' : '🔥';
  }

  tierColor(tier: string): string {
    return { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700' }[tier] ?? '#9fb2d6';
  }

  progressPercent(m: DailyMissionItem): number {
    if (m.progressMax <= 0) return 0;
    return Math.min(100, Math.round((m.progress / m.progressMax) * 100));
  }

  openLogActivity() {
    const ref = this.dialog.open(LogActivityDialogComponent, { width: '560px', maxWidth: '95vw', panelClass: 's4y-watch-dialog' });
    ref.afterClosed().subscribe(result => { if (result?.points !== undefined) this.loadData(); });
  }

  formatSport(sport: string) { return sport.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  sportIcon(sport: string) { return SPORT_ICONS[sport] ?? '🏅'; }
  sportIconForUser(i: number) { return this.LEADERBOARD_ICONS[i] ?? '🏅'; }
  sportBg(sport: string) {
    const map: Record<string, string> = {
      running: '#EAF7C9', walking: '#E7F0FF', cycling: '#E7F0FF',
      swimming: '#E7F6FA', gym: '#F5E7FF', daily_steps: '#FFF3E0',
    };
    return map[sport] ?? '#F4F6FB';
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatMetric(a: ActivityItem) {
    if (a.distance != null) return `${a.distance} km`;
    if (a.duration != null) return a.duration;
    if (a.steps != null) return `${a.steps.toLocaleString()} steps`;
    return '';
  }
}
