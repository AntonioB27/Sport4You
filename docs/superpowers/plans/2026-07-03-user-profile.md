# Phase 4b: User Profile Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile/:userId` page that shows any user's avatar, stats, and achievements (public view), and doubles as an avatar-management hub for the logged-in user (tabbed OVERVIEW + AVATARS).

**Architecture:** Backend adds `rank` and `currentStreak` to `DashboardDto` so the profile page needs only one API call; `ProfileComponent` reads the `:userId` route param, detects own-vs-other, and lazy-loads the avatar grid only when the AVATARS tab is first opened. The standalone `AvatarsComponent` is deleted — its grid logic moves into the AVATARS tab of `ProfileComponent`. The AVATARS nav link becomes PROFILE.

**Tech Stack:** C# 12 / ASP.NET Core 8 / EF Core 8 / xUnit — backend; Angular 17 standalone components, `@if`/`@for` control flow, `ActivatedRoute` URL params — frontend.

## Global Constraints

- No new API endpoints — backend change is an additive field on an existing response shape.
- `rank` is `int`, value `0` means not ranked (impossible for registered users; kept as a safety net).
- `currentStreak` is `int`, value `0` when no qualifying activities.
- AVATARS tab shown only when `isOwnProfile` (own userId matches route param).
- Earned-avatars showcase in public OVERVIEW shows only unlocked avatars, read-only, no equip buttons.
- Avatar grid in AVATARS tab: unlocked-first sort (by `unlockedAt` desc), locked cards greyed (opacity 0.45, grayscale 0.7).
- Active avatar: 120 px circle, `3px solid #2E6BE6` border. Fallback: first-initial badge same size, `#2E6BE6` bg.
- Stats chips: Rank (`#N` or `—` when 0), Points (number pipe), Streak (`Nd`).
- Achievements showcase: up to 6 unlocked achievements from `data.recentAchievements`.
- No-commit rule: Antonio handles all commits.
- All existing 82 backend tests must continue to pass.

---

### Task 1: Backend — add `rank` and `currentStreak` to dashboard response

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs`
- Modify: `backend/Sport4You.Api/Services/DashboardService.cs`
- Create: `backend/Sport4You.Tests/DashboardControllerTests.cs`

**Interfaces:**
- Consumes: `ILeaderboardService.GetLeaderboardAsync() → Task<List<LeaderboardEntryDto>>`; `ActivityStreakHelper.ComputeCurrentStreak(IEnumerable<DateTime>) → int` (internal static, same assembly)
- Produces: `DashboardDto.Rank int`, `DashboardDto.CurrentStreak int`; `DashboardDto.RecentAchievements` bumped from Take(3) to Take(6)

- [ ] **Step 1: Add fields to `DashboardDto`**

Open `backend/Sport4You.Api/DTOs/DashboardDto.cs`. Add two properties to `DashboardDto`:

```csharp
namespace Sport4You.Api.DTOs;

public class DashboardDto
{
    public UserInfoDto User { get; set; } = new();
    public int TotalPoints { get; set; }
    public int Rank { get; set; }
    public int CurrentStreak { get; set; }
    public List<ActivityDto> Activities { get; set; } = [];
    public List<PointsOverTimeDto> PointsOverTime { get; set; } = [];
    public List<SportBreakdownDto> SportBreakdown { get; set; } = [];
    public XpDto Xp { get; set; } = new();
    public List<DailyMissionDto> DailyMissions { get; set; } = [];
    public List<AchievementStatusDto> RecentAchievements { get; set; } = [];
    public AvatarStatusDto? ActiveAvatar { get; set; }
}
```

(Leave all other classes in the file unchanged.)

- [ ] **Step 2: Write the failing tests**

Create `backend/Sport4You.Tests/DashboardControllerTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class DashboardControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public DashboardControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetDashboard_WithActivity_ReturnsRankGt0AndStreak1()
    {
        var userId = await CreateUserAsync("Dash", "WithActivity");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = DateTime.UtcNow.ToString("o"), sport = "running", distance = 5.0 });

        var response = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("rank").GetInt32() >= 1);
        Assert.Equal(1, body.GetProperty("currentStreak").GetInt32());
    }

    [Fact]
    public async Task GetDashboard_NoActivities_ReturnsRankGt0AndStreak0()
    {
        var userId = await CreateUserAsync("Dash", "NoActivity");

        var response = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("rank").GetInt32() >= 1);
        Assert.Equal(0, body.GetProperty("currentStreak").GetInt32());
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test --filter "DashboardControllerTests" -v minimal 2>&1 | tail -10
```

Expected: tests fail because `rank` and `currentStreak` properties don't exist yet in the response (they'll be 0 by default — actually the `rank >= 1` assertion fails because the field isn't populated yet, and `currentStreak` field defaults to 0 so the second test might pass trivially — but `rank >= 1` will fail for the no-activity case since rank won't be computed).

- [ ] **Step 4: Update `DashboardService` to populate `Rank` and `CurrentStreak`**

Open `backend/Sport4You.Api/Services/DashboardService.cs`. Inject `ILeaderboardService` and populate the two new fields. Also bump `Take(3)` to `Take(6)` for the achievements showcase:

```csharp
// backend/Sport4You.Api/Services/DashboardService.cs
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IXpService _xp;
    private readonly IAchievementService _achievements;
    private readonly IAvatarService _avatars;
    private readonly ILeaderboardService _leaderboard;

    public DashboardService(
        IUserRepository users, IActivityRepository activities,
        IXpService xp, IAchievementService achievements,
        IAvatarService avatars, ILeaderboardService leaderboard)
    {
        _users = users;
        _activities = activities;
        _xp = xp;
        _achievements = achievements;
        _avatars = avatars;
        _leaderboard = leaderboard;
    }

    public async Task<DashboardDto?> GetDashboardAsync(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        var activities = await _activities.GetByUserIdAsync(userId);
        var xpSummary = await _xp.GetXpSummaryAsync(userId);
        var missionStatuses = await _xp.GetDailyMissionStatusAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow));
        var allAchievements = await _achievements.GetUserAchievementsAsync(userId);
        var recentAchievements = allAchievements
            .Where(a => a.Unlocked)
            .OrderByDescending(a => a.UnlockedAt)
            .Take(6)
            .ToList();
        var activeAvatar = await _avatars.GetActiveAvatarAsync(userId);
        var leaderboard = await _leaderboard.GetLeaderboardAsync();
        var leaderboardEntry = leaderboard.FirstOrDefault(e => e.UserId == userId);

        var pointsOverTime = activities
            .GroupBy(a => a.DateTime.Date)
            .Select(g => new PointsOverTimeDto
            {
                Date = g.Key.ToString("yyyy-MM-dd"),
                Points = g.Sum(a => a.Points)
            })
            .OrderBy(x => x.Date)
            .ToList();

        var sportBreakdown = activities
            .GroupBy(a => a.Sport)
            .Select(g => new SportBreakdownDto
            {
                Sport = g.Key,
                Points = g.Sum(a => a.Points)
            })
            .ToList();

        var xpDto = new XpDto(
            xpSummary.TotalXp,
            xpSummary.LevelInfo.Level,
            xpSummary.LevelInfo.Title,
            xpSummary.LevelInfo.XpInLevel,
            xpSummary.LevelInfo.XpForNextLevel,
            xpSummary.LevelInfo.XpPercent);

        var missionDtos = missionStatuses.Select(m => new DailyMissionDto(
            m.Id, m.Tier, m.Description, m.XpReward,
            m.Completed, m.Progress, m.ProgressMax)).ToList();

        return new DashboardDto
        {
            User = new UserInfoDto { FirstName = user.FirstName, LastName = user.LastName },
            TotalPoints = activities.Sum(a => a.Points),
            Rank = leaderboardEntry?.Rank ?? 0,
            CurrentStreak = ActivityStreakHelper.ComputeCurrentStreak(activities.Select(a => a.DateTime)),
            Activities = activities.Select(a => new ActivityDto
            {
                Id = a.Id,
                DateTime = a.DateTime.ToString("o"),
                Sport = a.Sport,
                Distance = a.Distance,
                Duration = a.Duration,
                Steps = a.Steps,
                Points = a.Points
            }).ToList(),
            PointsOverTime = pointsOverTime,
            SportBreakdown = sportBreakdown,
            Xp = xpDto,
            DailyMissions = missionDtos,
            RecentAchievements = recentAchievements,
            ActiveAvatar = activeAvatar,
        };
    }
}
```

- [ ] **Step 5: Run all backend tests**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test -v minimal 2>&1 | tail -10
```

Expected: all tests pass (82 existing + 2 new = 84 total).

---

### Task 2: Frontend — `ProfileComponent`, routing, nav, and dashboard simplification

**Files:**
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Create: `frontend/src/app/profile/profile.component.ts`
- Delete: `frontend/src/app/avatars/avatars.component.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/leaderboard/leaderboard.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `DashboardData.rank: number`, `DashboardData.currentStreak: number` (from Task 1); `ApiService.getDashboard(userId)`, `ApiService.getAvatars(userId)`, `ApiService.setActiveAvatar(userId, avatarId)` (all exist); `achievementIconPath(a)` from `frontend/src/app/shared/utils/achievement-icon.ts`

- [ ] **Step 1: Add `rank` and `currentStreak` to `DashboardData`**

Open `frontend/src/app/shared/models/dashboard.model.ts`. Add two fields to the `DashboardData` interface:

```typescript
export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  rank: number;
  currentStreak: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
  recentAchievements: AchievementStatus[];
  activeAvatar: AvatarStatus | null;
}
```

Leave all other interfaces in the file unchanged.

- [ ] **Step 2: Create `ProfileComponent`**

Create `frontend/src/app/profile/profile.component.ts` with the full content below:

```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, AchievementStatus, AvatarStatus } from '../shared/models/dashboard.model';
import { achievementIconPath } from '../shared/utils/achievement-icon';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatSnackBarModule],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 680px; margin: 0 auto; }
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

    /* Avatar grid (AVATARS tab) */
    .av-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .av-card {
      background: #fff; border-radius: 16px; border: 2px solid #E3EAF5;
      padding: 0 16px 14px; overflow: hidden; transition: box-shadow .15s;
    }
    .av-card:hover { box-shadow: 0 8px 20px -10px rgba(46,107,230,.2); }
    .av-card.locked { opacity: .45; filter: grayscale(.7); }
    .av-card.active { border-color: #2E6BE6; box-shadow: 0 0 0 2px rgba(46,107,230,.25); }
    .av-card-img { display: block; width: calc(100% + 32px); margin: 0 -16px 12px; aspect-ratio: 1; object-fit: cover; border-radius: 14px 14px 0 0; }
    .av-card-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #10203E; line-height: 1.2; margin-bottom: 4px; }
    .av-card-desc { font-size: 11px; color: #8592ad; line-height: 1.4; margin-bottom: 10px; }
    .av-card-date { font-size: 10px; color: #b0bcd4; margin-bottom: 10px; }
    .av-card-badge {
      display: inline-block; background: #EEF3FB; border-radius: 999px;
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: .1em; color: #2E6BE6; padding: 3px 10px; margin-bottom: 10px;
    }
    .equip-btn {
      width: 100%; padding: 8px; border-radius: 10px; border: none; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px;
      background: linear-gradient(150deg, #2E6BE6, #1B47AE); color: #fff; transition: opacity .15s;
    }
    .equip-btn:hover { opacity: .88; }
    .equip-btn:disabled { background: #E3EAF5; color: #8592ad; cursor: default; opacity: 1; }
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
            <div class="av-grid">
              @for (a of sortedAvatars; track a.id) {
                <div class="av-card" [class.locked]="!a.unlocked" [class.active]="a.isActive">
                  <img class="av-card-img" [src]="a.imagePath" [alt]="a.name">
                  @if (a.isActive) {
                    <div class="av-card-badge">ACTIVE</div>
                  }
                  <div class="av-card-name">{{ a.name }}</div>
                  <div class="av-card-desc">{{ a.description }}</div>
                  @if (a.unlocked && a.unlockedAt) {
                    <div class="av-card-date">Unlocked {{ a.unlockedAt | date:'MMM d, y' }}</div>
                  }
                  @if (a.unlocked) {
                    <button class="equip-btn" [disabled]="a.isActive || equipping" (click)="equip(a)">
                      {{ a.isActive ? 'EQUIPPED' : 'EQUIP' }}
                    </button>
                  }
                </div>
              }
            </div>
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
    return (this.data?.recentAchievements ?? []).filter(a => a.unlocked);
  }

  get earnedAvatars(): AvatarStatus[] {
    return this.avatars.filter(a => a.unlocked);
  }

  get unlockedCount(): number {
    return this.avatars.filter(a => a.unlocked).length;
  }

  get sortedAvatars(): AvatarStatus[] {
    return [...this.avatars].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      if (a.unlocked && b.unlocked)
        return new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime();
      return 0;
    });
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
      },
      error: () => { this.equipping = false; },
    });
  }
}
```

- [ ] **Step 3: Update `app.routes.ts`**

Replace the entire file. Adds `/profile/:userId`, removes `/avatars`:

```typescript
// frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'leaderboard', pathMatch: 'full' },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'achievements',
    loadComponent: () =>
      import('./achievements/achievements.component').then(m => m.AchievementsComponent),
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('./profile/profile.component').then(m => m.ProfileComponent),
  },
];
```

- [ ] **Step 4: Update `app.component.ts` nav links**

In `app.component.ts`, the nav needs two changes:
1. Replace the AVATARS `<a>` in the sidebar with a PROFILE link bound to the current user's profile URL.
2. Replace the AVATARS `<a>` in the bottom nav with a PROFILE link.
3. Replace the ME placeholder `<span>` in the bottom nav (it was a placeholder; it is now the PROFILE link).

**Add a getter to the class:**

Find the `AppComponent` class body and add this getter:

```typescript
  get profileRoute(): string[] {
    return ['/profile', localStorage.getItem('userId') ?? ''];
  }
```

**Replace the AVATARS sidebar link** (find this block):

```html
        <a class="nav-item" routerLink="/avatars" routerLinkActive="active">
          <span class="icon">🎭</span> AVATARS
        </a>
```

Replace with:

```html
        <a class="nav-item" [routerLink]="profileRoute" routerLinkActive="active">
          <span class="icon">👤</span> PROFILE
        </a>
```

**Replace the AVATARS bottom-nav link** (find this block):

```html
      <a class="bottom-nav-item" routerLink="/avatars" routerLinkActive="active">
        <span class="icon">🎭</span> AVATARS
      </a>
      <span class="bottom-nav-item"><span class="icon">👤</span> ME</span>
```

Replace with:

```html
      <a class="bottom-nav-item" [routerLink]="profileRoute" routerLinkActive="active">
        <span class="icon">👤</span> PROFILE
      </a>
```

(Remove the ME `<span>` — the PROFILE link replaces both.)

- [ ] **Step 5: Update `leaderboard.component.ts` — navigate to profile**

Open `frontend/src/app/leaderboard/leaderboard.component.ts`.

Find `viewDashboard(entry: LeaderboardEntry)`:

```typescript
  viewDashboard(entry: LeaderboardEntry) {
    localStorage.setItem('viewingUserId', entry.userId);
    this.router.navigate(['/dashboard']);
  }
```

Replace with:

```typescript
  viewProfile(entry: LeaderboardEntry) {
    this.router.navigate(['/profile', entry.userId]);
  }
```

In the template, find every `(click)="viewDashboard(..."` occurrence (there are 4: three podium slots and the list rows). Replace each with `(click)="viewProfile(..."`.

- [ ] **Step 6: Simplify `dashboard.component.ts`**

Open `frontend/src/app/dashboard/dashboard.component.ts`.

**6a. Remove `viewingUserId` from `ngOnInit`**

Find:
```typescript
  ngOnInit() {
    const userId = localStorage.getItem('viewingUserId') ?? localStorage.getItem('userId');
    localStorage.removeItem('viewingUserId');
    if (!userId) { this.loading = false; return; }
    this.loadData(userId);
```

Replace with:
```typescript
  ngOnInit() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loadData(userId);
```

**6b. Remove `rank` and `streak` component fields** (they now come from `data`)

Find and delete these two field declarations:
```typescript
  streak = 0;
  rank = 0;
```

**6c. Remove manual streak computation from `loadData`**

In the `loadData` method's `next` handler, find and delete only this one line (leave `this.loadLeaderboard(uid)` in place — it still drives the mini leaderboard widget):
```typescript
        this.streak = this.calculateStreak(data.activities);
```

**6d. Simplify `loadLeaderboard` — remove rank assignment**

Find in `loadLeaderboard`:
```typescript
      next: entries => {
        const me = entries.find(e => e.userId === myId);
        this.rank = me?.rank ?? 0;
        this.topEntries = entries.slice(0, 4).map(e => ({ ...e, isMe: e.userId === myId }));
      },
```

Replace with:
```typescript
      next: entries => {
        this.topEntries = entries.slice(0, 4).map(e => ({ ...e, isMe: e.userId === myId }));
      },
```

**6e. Remove `ActivityItem` from imports if unused**

After removing `calculateStreak`, `ActivityItem` may no longer be referenced in `dashboard.component.ts`. Check: if `ActivityItem` appears only in the deleted method signature, remove it from the import line:

```typescript
// Before (if ActivityItem is unused elsewhere):
import { DashboardData, ActivityItem, DailyMissionItem } from '../shared/models/dashboard.model';
// After:
import { DashboardData, DailyMissionItem } from '../shared/models/dashboard.model';
```

If `ActivityItem` is still used elsewhere in the file, leave the import unchanged.

**6f. Delete `calculateStreak` method**

Find and delete the entire private method:
```typescript
  private calculateStreak(activities: ActivityItem[]): number {
    if (!activities.length) return 0;
    const uniqueDates = [...new Set(activities.map(a => new Date(a.dateTime).toDateString()))]
      .map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0; let cursor = today;
    for (const date of uniqueDates) {
      const diff = Math.round((cursor.getTime() - date.getTime()) / 86400000);
      if (diff === 0 || diff === 1) { streak++; cursor = date; } else break;
    }
    return streak;
  }
```

**6g. Update template to use `data?.rank` and `data?.currentStreak`**

Find the rank stat in the template (looks like):
```html
                <div class="stat-value blue">#{{ rank }}</div>
```

Replace with:
```html
                <div class="stat-value blue">{{ (data?.rank ?? 0) > 0 ? '#' + data!.rank : '—' }}</div>
```

Find the streak badge (looks like):
```html
            <div class="streak-badge" *ngIf="streak > 0">🔥 {{ streak }} day streak</div>
```

Replace with:
```html
            <div class="streak-badge" *ngIf="(data?.currentStreak ?? 0) > 0">🔥 {{ data!.currentStreak }} day streak</div>
```

- [ ] **Step 7: Delete `avatars.component.ts`**

Delete the file:
```bash
rm /Users/antoniobecic/repo/neogov/sport4you/frontend/src/app/avatars/avatars.component.ts
```

- [ ] **Step 8: Build check**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build --no-progress 2>&1 | grep -E "error|complete"
```

Expected: `Application bundle generation complete` with 0 errors. Any `viewingUserId`, `avatars.component`, or `/avatars` references that remain would show as errors or warnings — there should be none.
