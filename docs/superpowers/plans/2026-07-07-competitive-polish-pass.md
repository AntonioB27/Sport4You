# Competitive Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four gaps found when comparing Sport4You against two other public solutions
to the same take-home assignment: frontend tests not wired into CI, minimal Angular Signals
usage, no structured/request logging, and no mocked-dependency unit tests.

**Architecture:** Four independent, small changes — a CI workflow edit, an Angular
rewrite of two already-clean files plus one small service, a logging library wired into
`Program.cs`, and a new mocked-unit-test file. No shared code between tasks; each is
independently reviewable and testable.

**Tech Stack:** GitHub Actions, Angular 17 (Signals), Serilog (ASP.NET Core 8), Moq (xUnit).

## Global Constraints

- **A `/api/health` endpoint already exists** (`Program.cs`, minimal API, checks real DB
  connectivity via `db.Database.CanConnectAsync()`) — this was discovered mid-design and is
  NOT part of this plan. Do not add a second health endpoint or a `HealthController`.
- The Angular Signals task (Task 2) touches **only** `user-state.service.ts`,
  `app.component.ts`, and `today-steps-card.component.ts` — confirmed clean in `git status`
  at design time. **Before starting Task 2, re-check `git status` on these three files.** If
  any of them show as modified by the time this task runs, stop and report back rather than
  proceeding — a separate, unrelated session is doing a visual redesign across most other
  frontend files, and colliding with it is the one thing this plan must avoid.
- No changes to `LeaderboardEntryDto`, any other DTO, or any currently-passing test's
  assertions.
- Do NOT commit — the user commits manually (matches this session's established convention
  for every plan executed so far).

---

### Task 1: CI — run frontend tests

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `karma-chrome-launcher` (already a `frontend/package.json` devDependency —
  provides the `ChromeHeadless` launcher; no new dependency needed).
- Produces: nothing consumed by later tasks — this plan's tasks are independent.

- [ ] **Step 1: Add a frontend test step to the CI workflow**

In `.github/workflows/ci.yml`, the `frontend-build` job currently reads:

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npx ng build --configuration production
```

Insert a `Test` step between `Install dependencies` and `Build` (so a broken frontend test
fails CI before spending time on a build):

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npx ng test --no-watch --no-progress --browsers=ChromeHeadless

      - name: Build
        run: npx ng build --configuration production
```

- [ ] **Step 2: Verify locally**

Run: `cd frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadless`
Expected: the existing 3 spec files run and pass (12 test cases:
`app.component.spec.ts`, `tour.service.spec.ts`, `auth.guard.spec.ts`). This is the same
command CI will run, so a local pass here means CI will pass too.

- [ ] **Step 3: Commit**

Per this plan's Global Constraints, do NOT commit. Leave `ci.yml` modified in the working
tree.

---

### Task 2: Angular Signals — `UserStateService`, `app.component.ts`, `TodayStepsCardComponent`

**Files:**
- Modify: `frontend/src/app/shared/services/user-state.service.ts`
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts`

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: `UserStateService.xp` becomes a `Signal<XpInfo | null>` (was
  `Observable<XpInfo | null>` named `xp$`); its `setXp(xp: XpInfo): void` method signature is
  **unchanged**, so `dashboard.component.ts`'s existing call site
  (`this.userState.setXp(data.xp)`, around line 643) requires **no edit** — do not touch
  `dashboard.component.ts` in this task. `TodayStepsCardComponent`'s `[todaySteps]` input and
  `(stepsAdded)` output keep the exact same template binding syntax whether decorator-based
  or signal-based, so `dashboard.component.ts`'s
  `<app-today-steps-card [todaySteps]="data?.todaySteps ?? 0" (stepsAdded)="loadData()">`
  usage also requires **no edit**.

**Before Step 1:** re-run
`git status --porcelain frontend/src/app/shared/services/user-state.service.ts frontend/src/app/app.component.ts frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts`.
Expected: no output (all three clean). If any show as modified, STOP and report back — do
not proceed with this task.

- [ ] **Step 1: Convert `UserStateService` to a signal**

Replace the full contents of `frontend/src/app/shared/services/user-state.service.ts`:

```typescript
import { Injectable, signal } from '@angular/core';
import { XpInfo } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private readonly xpSignal = signal<XpInfo | null>(null);
  readonly xp = this.xpSignal.asReadonly();

  setXp(xp: XpInfo): void {
    this.xpSignal.set(xp);
  }
}
```

- [ ] **Step 2: Update `app.component.ts`'s consumption of the signal**

In `frontend/src/app/app.component.ts`:

Remove `AsyncPipe` from the imports (it is used nowhere else in this file — confirmed by
`grep -n "async" frontend/src/app/app.component.ts` showing only the one `| async` usage
being replaced below):

```typescript
import { CommonModule, AsyncPipe } from '@angular/common';
```
becomes
```typescript
import { CommonModule } from '@angular/common';
```

And in the `@Component` decorator's `imports` array, remove `AsyncPipe`:

```typescript
imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AsyncPipe, IconComponent, TourOverlayComponent],
```
becomes
```typescript
imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, IconComponent, TourOverlayComponent],
```

In the template, change:

```html
      @if (userState.xp$ | async; as xp) {
```
to
```html
      @if (userState.xp(); as xp) {
```

(No other line in the `@if`/`@else` block changes — `xp.xpForNextLevel`, `xp.xpInLevel`,
`xp.xpPercent` are unaffected since `xp` is still just the unwrapped `XpInfo` value.)

- [ ] **Step 3: Convert `TodayStepsCardComponent` to signal-based inputs/outputs/state**

Replace the full contents of
`frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts`:

```typescript
import { Component, DestroyRef, computed, effect, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { UnlockSplashDialogComponent } from '../../shared/components/unlock-splash/unlock-splash-dialog.component';

const STEP_GOAL = 10000;

@Component({
  selector: 'app-today-steps-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  styles: [`
    :host { display:block; height:100%; }
    .fx { filter: drop-shadow(0 14px 24px rgba(16,32,62,.15)); height:100%; }
    .card {
      position:relative; height:100%; background:#fff; box-shadow: inset 0 0 0 1px #E6ECF6;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
      padding:20px 22px;
    }
    .sec-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .sec-bar { width:3px; height:16px; background:#9ECF10; box-shadow:0 0 8px rgba(158,207,16,.7); flex-shrink:0; }
    .title { font-family:'Chakra Petch',sans-serif; font-size:13px; font-weight:700; letter-spacing:.16em; color:#10203E; }
    .ring-wrap { display:flex; justify-content:center; margin-bottom:14px; }
    .ring { --p:0; width:120px; height:120px; border-radius:50%; flex-shrink:0;
      background:conic-gradient(from -90deg, #8CE00E, #C6E63B calc(var(--p)*1%), #EAEEF6 0);
      display:flex; align-items:center; justify-content:center; }
    .ring-inner { width:98px; height:98px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .ring-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#10203E; line-height:1; }
    .ring-goal { font-size:10px; color:#8592ad; margin-top:3px; }
    .foot { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#5f7a00; white-space:nowrap; }
    .add-row { display:flex; gap:6px; margin-top:12px; }
    .add-input { flex:1; min-width:0; background:#F7FAFF; border:1px solid #E6ECF6; border-radius:8px; padding:8px 10px; color:#10203E; font-family:'Nunito',sans-serif; font-size:14px; }
    .add-input::placeholder { color:#9aa6bd; }
    .add-btn { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; border:none; padding:8px 16px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em; cursor:pointer; box-shadow:0 3px 0 #7c9c00; flex-shrink:0;
      clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px); }
    .add-btn:disabled { opacity:.5; cursor:default; box-shadow:none; }
    .err { color:#e5484d; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="fx"><div class="card">
      <div class="sec-title"><span class="sec-bar"></span><span class="title">STEP CORE</span></div>
      <div class="ring-wrap">
        <div class="ring" [style.--p]="progressPercent()">
          <div class="ring-inner">
            <div class="ring-val">{{ displaySteps().toLocaleString('en-US') }}</div>
            <div class="ring-goal">/ {{ goal.toLocaleString('en-US') }}</div>
          </div>
        </div>
      </div>
      <div class="foot">
        <span class="pts">+{{ pointsFromSteps() }} PTS TODAY</span>
      </div>
      <div class="add-row">
        <input class="add-input" type="number" inputmode="numeric" min="1" max="100000"
               placeholder="Add steps…" [(ngModel)]="entry" [disabled]="loading()"
               (keyup.enter)="add()">
        <button class="add-btn" [disabled]="loading()" (click)="add()">+ ADD</button>
      </div>
      <div class="err" *ngIf="errorMsg()">{{ errorMsg() }}</div>
    </div></div>
  `,
})
export class TodayStepsCardComponent {
  readonly todaySteps = input(0);
  readonly stepsAdded = output<void>();

  readonly goal = STEP_GOAL;
  readonly displaySteps = signal(0);
  entry: number | null = null;
  readonly loading = signal(false);
  readonly errorMsg = signal('');

  readonly progressPercent = computed(() =>
    Math.min(100, Math.round((this.displaySteps() / this.goal) * 100)));
  readonly pointsFromSteps = computed(() => Math.floor(this.displaySteps() / 100));

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private destroyRef: DestroyRef,
  ) {
    effect(() => this.displaySteps.set(this.todaySteps()));
  }

  add(): void {
    const userId = localStorage.getItem('userId');
    const steps = Math.floor(Number(this.entry));
    if (!userId) return;
    if (!steps || steps <= 0) { this.errorMsg.set('Enter a step count above zero.'); return; }
    if (steps > 100000) { this.errorMsg.set('Max 100,000 steps per entry.'); return; }

    this.loading.set(true); this.errorMsg.set('');
    this.api.addSteps(userId, steps)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: res => {
        this.loading.set(false);
        this.entry = null;
        this.displaySteps.set(res.todayTotalSteps);

        res.missionsCompleted.forEach((m, i) => {
          setTimeout(() => {
            this.snackBar.open(
              `Quest complete! ${m.description} · +${m.xpEarned} XP`,
              '', { duration: 3500, panelClass: 's4y-toast' });
          }, i * 600);
        });

        if (res.achievementsUnlocked.length > 0 || res.avatarsUnlocked.length > 0) {
          this.dialog.open(UnlockSplashDialogComponent, {
            data: { achievements: res.achievementsUnlocked, avatars: res.avatarsUnlocked },
            panelClass: 's4y-watch-dialog',
            width: '400px',
          });
        }

        this.stepsAdded.emit();
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Failed to add steps. Please try again.');
      },
    });
  }
}
```

Note what changed vs. the original, so you can sanity-check the edit: `@Input()`/`@Output()`
became `input()`/`output()`; `implements OnChanges` and the `ngOnChanges()` method are gone,
replaced by an `effect()` in the constructor that keeps `displaySteps` in sync with the
`todaySteps` input signal whenever it changes (this is the signal-native replacement for
`ngOnChanges`); `displaySteps`/`loading`/`errorMsg` became `signal()`s (read via `()`, written
via `.set()`); `progressPercent`/`pointsFromSteps` became `computed()`s (read via `()`); the
template's bindings to these were updated to call them as functions. `entry` stays a plain
property (a two-way `[(ngModel)]`-bound signal needs the separate `model()` API, which is out
of scope here — no behavior change, just not converted).

- [ ] **Step 4: Build and manually verify**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds with no new errors from these three files (pre-existing warnings
from unrelated in-flight redesign files are not this task's concern).

With the backend and `ng serve` running: confirm the sidebar XP widget still shows the
correct "NEXT LEVEL IN" value after logging an activity (exercises the `UserStateService`
signal end-to-end), and confirm the dashboard's Step Core card still displays/updates steps
correctly when adding steps (exercises the `TodayStepsCardComponent` signal conversion,
including the achievement/avatar unlock dialog still firing when applicable).

- [ ] **Step 5: Commit**

Per this plan's Global Constraints, do NOT commit.

---

### Task 3: Structured logging (Serilog)

**Files:**
- Modify: `backend/Sport4You.Api/Sport4You.Api.csproj`
- Modify: `backend/Sport4You.Api/Program.cs`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the Serilog package**

In `backend/Sport4You.Api/Sport4You.Api.csproj`, add to the existing `<ItemGroup>` of
`<PackageReference>` entries:

```xml
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.1" />
```

Run: `cd backend && dotnet restore`
Expected: restores successfully, no version conflicts.

- [ ] **Step 2: Wire Serilog into `Program.cs`**

In `backend/Sport4You.Api/Program.cs`, add to the top of the `using` block:

```csharp
using Serilog;
using Serilog.Events;
```

Immediately after `var builder = WebApplication.CreateBuilder(args);`, add:

```csharp
builder.Host.UseSerilog((context, configuration) => configuration
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console());
```

Immediately after `app.UseMiddleware<Sport4You.Api.Middleware.ExceptionMiddleware>();`, add:

```csharp
app.UseSerilogRequestLogging();
```

(Placed after the exception middleware so request logging still captures requests that
throw, matching where this pattern was verified working in a reference implementation.)

- [ ] **Step 3: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS, same count as before this task (Serilog must not break the test host —
`WebApplicationFactory`-based integration tests build the same `Program` composition root,
so a Serilog misconfiguration would surface here). Do not proceed if any test fails or if
startup throws.

- [ ] **Step 4: Manually verify request logging**

Run: `cd backend && dotnet run --project Sport4You.Api`
Expected: console output shows Serilog-formatted request log lines (e.g.
`HTTP GET /api/leaderboard responded 200 in ##.####ms`) as requests come in, and no
`Microsoft.EntityFrameworkCore.Database.Command` SQL-statement spam (suppressed by the
`Warning`-level override).

- [ ] **Step 5: Commit**

Per this plan's Global Constraints, do NOT commit.

---

### Task 4: Mocked unit tests (Moq) for `ActivityService.LogDailyStepsAsync`

**Files:**
- Modify: `backend/Sport4You.Tests/Sport4You.Tests.csproj`
- Create: `backend/Sport4You.Tests/ActivityServiceMockedTests.cs`

**Interfaces:**
- Consumes: `ActivityService` (concrete class, `backend/Sport4You.Api/Services/ActivityService.cs`)
  and its 8 constructor dependencies — `IUserRepository`, `IActivityRepository`,
  `IScoringService`, `IXpService`, `IAchievementService`, `IAvatarService`,
  `ILootBoxService`, `IShopService` — all mocked, no real database.
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Add the Moq package**

In `backend/Sport4You.Tests/Sport4You.Tests.csproj`, add to the existing `<ItemGroup>` of
`<PackageReference>` entries:

```xml
    <PackageReference Include="Moq" Version="4.20.72" />
```

- [ ] **Step 2: Write the mocked unit tests**

Create `backend/Sport4You.Tests/ActivityServiceMockedTests.cs`:

```csharp
using Moq;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

/// <summary>
/// True isolated unit tests for ActivityService.LogDailyStepsAsync — every collaborator is
/// mocked, no database involved. Complements (does not replace) the real-DB integration
/// tests for the same method elsewhere in this project.
/// </summary>
public class ActivityServiceMockedTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IActivityRepository> _activities = new();
    private readonly Mock<IScoringService> _scoring = new();
    private readonly Mock<IXpService> _xp = new();
    private readonly Mock<IAchievementService> _achievements = new();
    private readonly Mock<IAvatarService> _avatars = new();
    private readonly Mock<ILootBoxService> _lootBox = new();
    private readonly Mock<IShopService> _shop = new();

    private ActivityService BuildSut() => new(
        _users.Object, _activities.Object, _scoring.Object, _xp.Object,
        _achievements.Object, _avatars.Object, _lootBox.Object, _shop.Object);

    [Fact]
    public async Task LogDailyStepsAsync_UserNotFound_ReturnsNotFoundWithoutTouchingRepository()
    {
        _users.Setup(u => u.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var result = await BuildSut().LogDailyStepsAsync(Guid.NewGuid(), 500);

        Assert.True(result.IsNotFound);
        _activities.Verify(a => a.GetByUserIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100001)]
    public async Task LogDailyStepsAsync_InvalidStepCount_ReturnsBadRequestWithoutHittingRepository(int steps)
    {
        var result = await BuildSut().LogDailyStepsAsync(Guid.NewGuid(), steps);

        Assert.True(result.IsError);
        _users.Verify(u => u.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task LogDailyStepsAsync_NewStreakDay_AwardsXpCoinsAndLootBox()
    {
        var userId = Guid.NewGuid();
        _users.Setup(u => u.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, FirstName = "Test", LastName = "User" });
        _activities.Setup(a => a.GetByUserIdAsync(userId)).ReturnsAsync(new List<Activity>());
        _activities.Setup(a => a.CreateAsync(It.IsAny<Activity>())).ReturnsAsync(new Activity());

        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 2000)).Returns(20);
        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 0)).Returns(0);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 2000)).Returns(10);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 0)).Returns(0);
        _xp.Setup(x => x.EvaluateDailyMissionsAsync(userId, It.IsAny<DateOnly>()))
            .ReturnsAsync(new MissionEvaluationResult(new List<CompletedMissionDto>(), 0));
        _achievements.Setup(a => a.EvaluateAchievementsAsync(userId))
            .ReturnsAsync(new List<UnlockedAchievementDto>());
        _avatars.Setup(a => a.EvaluateAvatarsAsync(userId))
            .ReturnsAsync(new List<UnlockedAvatarDto>());

        var result = await BuildSut().LogDailyStepsAsync(userId, 2000);

        Assert.False(result.IsError);
        Assert.Equal(2000, result.TodayTotalSteps);
        Assert.Equal(20, result.PointsEarned);
        _xp.Verify(x => x.AwardGenericXpAsync(userId, 10, "activity", It.IsAny<Guid>()), Times.Once);
        _shop.Verify(s => s.AddCoinsAsync(userId, 2), Times.Once);
        _lootBox.Verify(l => l.EarnBoxAsync(userId, "streak"), Times.Once);
        _activities.Verify(a => a.CreateAsync(It.IsAny<Activity>()), Times.Once);
        _activities.Verify(a => a.UpdateAsync(It.IsAny<Activity>()), Times.Never);
    }

    [Fact]
    public async Task LogDailyStepsAsync_SameDaySecondEntry_DoesNotAwardAnotherStreakBox()
    {
        var userId = Guid.NewGuid();
        var todayRow = new Activity
        {
            Id = Guid.NewGuid(), UserId = userId, Sport = "daily_steps",
            DateTime = DateTime.UtcNow, Steps = 1000, Points = 10,
        };
        _users.Setup(u => u.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, FirstName = "Test", LastName = "User" });
        _activities.Setup(a => a.GetByUserIdAsync(userId)).ReturnsAsync(new List<Activity> { todayRow });

        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 1500)).Returns(15);
        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 1000)).Returns(10);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 1500)).Returns(0);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 1000)).Returns(0);
        _xp.Setup(x => x.EvaluateDailyMissionsAsync(userId, It.IsAny<DateOnly>()))
            .ReturnsAsync(new MissionEvaluationResult(new List<CompletedMissionDto>(), 0));
        _achievements.Setup(a => a.EvaluateAchievementsAsync(userId))
            .ReturnsAsync(new List<UnlockedAchievementDto>());
        _avatars.Setup(a => a.EvaluateAvatarsAsync(userId))
            .ReturnsAsync(new List<UnlockedAvatarDto>());

        var result = await BuildSut().LogDailyStepsAsync(userId, 500);

        Assert.False(result.IsError);
        Assert.Equal(1500, result.TodayTotalSteps);
        _activities.Verify(a => a.UpdateAsync(It.IsAny<Activity>()), Times.Once);
        _activities.Verify(a => a.CreateAsync(It.IsAny<Activity>()), Times.Never);
        _lootBox.Verify(l => l.EarnBoxAsync(userId, "streak"), Times.Never);
    }
}
```

- [ ] **Step 3: Run the new tests**

Run: `cd backend && dotnet test Sport4You.Tests --filter "FullyQualifiedName~ActivityServiceMockedTests"`
Expected: PASS (4/4).

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS — same pre-existing test count plus these 4 new ones, nothing else affected
(these tests touch no shared fixture, no database, no other test file).

- [ ] **Step 5: Commit**

Per this plan's Global Constraints, do NOT commit.
