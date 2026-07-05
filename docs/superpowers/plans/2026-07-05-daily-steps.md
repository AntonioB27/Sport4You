# Daily Steps as a Separate, Accumulating Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn daily steps into a distinct feature — entered through a dedicated dashboard widget and accumulated into a single per-day total — without fracturing the `Activity`-derived data model that the leaderboard, charts, achievements, and streaks depend on.

**Architecture:** Steps remain `Activity` rows with `Sport = "daily_steps"`, but a new endpoint enforces one accumulating row per user per UTC calendar day: a second entry the same day updates that row's `Steps`/`Points` rather than inserting. The generic activity endpoint stops accepting steps. On the frontend, a new `TodayStepsCard` posts to the endpoint and the unlock-splash UI is extracted from the Log Activity dialog into a shared component reused by both.

**Tech Stack:** C# / ASP.NET Core Web API · EF Core · SQLite · xUnit (backend). Angular 17 standalone components · Angular Material (frontend).

## Global Constraints

- **Points formula (unchanged):** `points = floor(totalSteps / 100)`, computed via `ScoringService.CalculatePoints("daily_steps", null, null, totalSteps)`.
- **XP formula (unchanged):** `xp = floor(totalSteps / 500)`, via `XpService.CalculateActivityXp`.
- **Points/XP are computed from the day's running total, never per-submission** — the value a submission "earned" is the delta between the new total's score and the old total's score.
- **"Today" = UTC calendar day**: `[DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddDays(1))`. Consistent with existing mission/leaderboard boundaries.
- **Single-entry validation:** `steps` must be an integer with `0 < steps <= 100_000`.
- **Backend follows layered architecture:** Controller → Service → Repository → EF Core. Services are constructor-injected and registered in `Program.cs`.
- **Backend tests are integration-style** through `HttpClient` via `TestFactory` (SQLite), matching `Sport4You.Tests/ActivitiesControllerTests.cs`.
- **Frontend has no component-test convention** (only the default `app.component.spec.ts` exists). Frontend tasks are verified by `ng build` (compile/type-check) plus a manual smoke check — do not scaffold Jasmine specs for UI components.

---

## Task 1: Repository — `UpdateAsync`

**Files:**
- Modify: `backend/Sport4You.Api/Repositories/IActivityRepository.cs`
- Modify: `backend/Sport4You.Api/Repositories/ActivityRepository.cs`

**Interfaces:**
- Consumes: existing `AppDbContext _db`.
- Produces: `Task UpdateAsync(Activity activity)` on `IActivityRepository` — persists changes to an already-loaded, tracked `Activity`.

This task has no standalone test (a repository method with no behavior beyond `SaveChanges` is exercised by Task 2's endpoint tests). Keep it minimal.

- [ ] **Step 1: Add the method to the interface**

In `IActivityRepository.cs`, add inside the interface:

```csharp
Task UpdateAsync(Activity activity);
```

- [ ] **Step 2: Implement it**

In `ActivityRepository.cs`, add:

```csharp
public async Task UpdateAsync(Activity activity)
{
    _db.Activities.Update(activity);
    await _db.SaveChangesAsync();
}
```

- [ ] **Step 3: Verify it compiles**

Run: `dotnet build backend/Sport4You.Api/Sport4You.Api.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/Sport4You.Api/Repositories/IActivityRepository.cs backend/Sport4You.Api/Repositories/ActivityRepository.cs
git commit -m "feat: add ActivityRepository.UpdateAsync for per-day steps accumulation"
```

---

## Task 2: Steps endpoint (accumulate per UTC day)

**Files:**
- Create: `backend/Sport4You.Api/DTOs/LogStepsRequest.cs`
- Modify: `backend/Sport4You.Api/Services/IActivityService.cs` (add `StepsResult` record + interface method)
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs` (implement `LogDailyStepsAsync`)
- Modify: `backend/Sport4You.Api/Controllers/UsersController.cs` (add route + inject `IActivityService`)
- Test: `backend/Sport4You.Tests/DailyStepsControllerTests.cs`

**Interfaces:**
- Consumes: `IActivityRepository.UpdateAsync` (Task 1); `IScoringService.CalculatePoints`; `IXpService.CalculateActivityXp`, `IXpService.AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId)`, `IXpService.EvaluateDailyMissionsAsync`; `IAchievementService.EvaluateAchievementsAsync`; `IAvatarService.EvaluateAvatarsAsync`; `ILootBoxService.EarnBoxAsync`; `ActivityStreakHelper.ComputeCurrentStreak`.
- Produces:
  - `record StepsResult(bool IsError, bool IsNotFound, string? Error, int TodayTotalSteps, int PointsEarned, int XpEarned, List<CompletedMissionDto> MissionsCompleted, List<UnlockedAchievementDto> AchievementsUnlocked, List<UnlockedAvatarDto> AvatarsUnlocked)` with static factories `Success(...)`, `BadRequest(string)`, `NotFound(string)`.
  - `Task<StepsResult> IActivityService.LogDailyStepsAsync(Guid userId, int steps)`.
  - Route `POST /api/users/{userId}/steps` with body `{ "steps": int }`, returning JSON `{ todayTotalSteps, pointsEarned, xpEarned, missionsCompleted, achievementsUnlocked, avatarsUnlocked }`.

- [ ] **Step 1: Write the failing test**

Create `backend/Sport4You.Tests/DailyStepsControllerTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class DailyStepsControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public DailyStepsControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    private static int Int(Dictionary<string, JsonElement> body, string key)
        => body[key].GetInt32();

    [Fact]
    public async Task AddSteps_FirstEntry_ReturnsTotalAndPoints()
    {
        var userId = await CreateUserAsync("Step", "One");

        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 5000 });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(5000, Int(body!, "todayTotalSteps"));
        Assert.Equal(50, Int(body!, "pointsEarned"));   // floor(5000/100)
        Assert.Equal(10, Int(body!, "xpEarned"));       // floor(5000/500)
    }

    [Fact]
    public async Task AddSteps_SecondEntry_AccumulatesIntoTotal()
    {
        var userId = await CreateUserAsync("Step", "Two");

        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 5000 });
        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 3000 });

        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(8000, Int(body!, "todayTotalSteps"));
        Assert.Equal(30, Int(body!, "pointsEarned"));   // floor(8000/100) - floor(5000/100) = 80 - 50
        Assert.Equal(6,  Int(body!, "xpEarned"));       // floor(8000/500) - floor(5000/500) = 16 - 10
    }

    [Fact]
    public async Task AddSteps_AccumulationCreatesOneRow_ReflectedInDashboard()
    {
        var userId = await CreateUserAsync("Step", "Three");

        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 4000 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 4000 });

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");
        var stepActivities = dash!["activities"].EnumerateArray()
            .Where(a => a.GetProperty("sport").GetString() == "daily_steps")
            .ToList();
        Assert.Single(stepActivities);                                  // one row, not two
        Assert.Equal(8000, stepActivities[0].GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task AddSteps_CrossesFloorBoundary_AwardsDeltaPoints()
    {
        var userId = await CreateUserAsync("Step", "Floor");

        var first = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 50 });
        var firstBody = await first.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(0, Int(firstBody!, "pointsEarned"));               // floor(50/100) = 0

        var second = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 60 });
        var secondBody = await second.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(110, Int(secondBody!, "todayTotalSteps"));
        Assert.Equal(1, Int(secondBody!, "pointsEarned"));             // floor(110/100) - floor(50/100) = 1 - 0
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    [InlineData(100_001)]
    public async Task AddSteps_InvalidAmount_Returns400(int steps)
    {
        var userId = await CreateUserAsync("Step", $"Bad{steps}");

        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task AddSteps_UnknownUser_Returns404()
    {
        var res = await _client.PostAsJsonAsync($"/api/users/{Guid.NewGuid()}/steps", new { steps = 1000 });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter DailyStepsControllerTests`
Expected: FAIL — the route `POST /api/users/{userId}/steps` does not exist yet (404 for all, compile passes because tests only use HTTP).

- [ ] **Step 3: Add the request DTO**

Create `backend/Sport4You.Api/DTOs/LogStepsRequest.cs`:

```csharp
namespace Sport4You.Api.DTOs;

public class LogStepsRequest
{
    public int Steps { get; set; }
}
```

- [ ] **Step 4: Add `StepsResult` and the interface method**

In `backend/Sport4You.Api/Services/IActivityService.cs`, add the record (next to `ActivityResult`) and the interface method:

```csharp
public record StepsResult(
    bool IsError, bool IsNotFound, string? Error,
    int TodayTotalSteps, int PointsEarned, int XpEarned,
    List<CompletedMissionDto> MissionsCompleted,
    List<UnlockedAchievementDto> AchievementsUnlocked,
    List<UnlockedAvatarDto> AvatarsUnlocked)
{
    public static StepsResult Success(
        int todayTotalSteps, int pointsEarned, int xpEarned,
        List<CompletedMissionDto> missions,
        List<UnlockedAchievementDto> achievements,
        List<UnlockedAvatarDto> avatars)
        => new(false, false, null, todayTotalSteps, pointsEarned, xpEarned, missions, achievements, avatars);

    public static StepsResult BadRequest(string error)
        => new(true, false, error, 0, 0, 0, [], [], []);

    public static StepsResult NotFound(string error)
        => new(true, true, error, 0, 0, 0, [], [], []);
}
```

Add to the `IActivityService` interface:

```csharp
Task<StepsResult> LogDailyStepsAsync(Guid userId, int steps);
```

- [ ] **Step 5: Implement `LogDailyStepsAsync`**

In `backend/Sport4You.Api/Services/ActivityService.cs`, add the method (all dependencies are already injected). Use `DateOnly` for the mission date exactly as `LogActivityAsync` does.

```csharp
public async Task<StepsResult> LogDailyStepsAsync(Guid userId, int steps)
{
    if (steps <= 0 || steps > 100_000)
        return StepsResult.BadRequest("Steps must be between 1 and 100000");

    var user = await _users.GetByIdAsync(userId);
    if (user == null)
        return StepsResult.NotFound("User not found");

    var now = DateTime.UtcNow;
    var todayStart = now.Date;
    var todayEnd = todayStart.AddDays(1);

    // Capture existing activities before mutating (for streak comparison)
    var previousActivities = await _activities.GetByUserIdAsync(userId);
    var prevStreak = ActivityStreakHelper.ComputeCurrentStreak(previousActivities.Select(a => a.DateTime));

    var todayRow = previousActivities.FirstOrDefault(a =>
        a.Sport == "daily_steps" && a.DateTime >= todayStart && a.DateTime < todayEnd);

    var oldTotal = todayRow?.Steps ?? 0;
    var newTotal = oldTotal + steps;

    var pointsEarned = _scoring.CalculatePoints("daily_steps", null, null, newTotal)
                     - _scoring.CalculatePoints("daily_steps", null, null, oldTotal);
    var xpEarned = _xp.CalculateActivityXp("daily_steps", null, null, newTotal)
                 - _xp.CalculateActivityXp("daily_steps", null, null, oldTotal);

    Activity row;
    if (todayRow != null)
    {
        todayRow.Steps = newTotal;
        todayRow.Points = _scoring.CalculatePoints("daily_steps", null, null, newTotal);
        todayRow.DateTime = now;
        await _activities.UpdateAsync(todayRow);
        row = todayRow;
    }
    else
    {
        row = new Activity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DateTime = now,
            Sport = "daily_steps",
            Distance = null,
            Duration = null,
            Steps = newTotal,
            Points = _scoring.CalculatePoints("daily_steps", null, null, newTotal),
        };
        await _activities.CreateAsync(row);
    }

    if (xpEarned > 0)
        await _xp.AwardGenericXpAsync(userId, xpEarned, "activity", row.Id);

    var missionResult = await _xp.EvaluateDailyMissionsAsync(
        userId, DateOnly.FromDateTime(now));

    var newAchievements = await _achievements.EvaluateAchievementsAsync(userId);
    var newAvatars = await _avatars.EvaluateAvatarsAsync(userId);

    // Streak box only if today extended the streak (a same-day second entry does not)
    var updatedActivities = todayRow != null
        ? previousActivities
        : previousActivities.Concat(new[] { row });
    var newStreak = ActivityStreakHelper.ComputeCurrentStreak(updatedActivities.Select(a => a.DateTime));
    if (newStreak > prevStreak)
        await _lootBox.EarnBoxAsync(userId, "streak");

    return StepsResult.Success(
        newTotal, pointsEarned, xpEarned,
        missionResult.NewlyCompleted, newAchievements, newAvatars);
}
```

- [ ] **Step 6: Add the controller route**

In `backend/Sport4You.Api/Controllers/UsersController.cs`, inject `IActivityService` and add the route.

Add the field and update the constructor:

```csharp
    private readonly IUserService _users;
    private readonly IDashboardService _dashboard;
    private readonly IActivityService _activities;

    public UsersController(IUserService users, IDashboardService dashboard, IActivityService activities)
    {
        _users = users;
        _dashboard = dashboard;
        _activities = activities;
    }
```

Add the action:

```csharp
    [HttpPost("{userId}/steps")]
    public async Task<IActionResult> AddSteps(Guid userId, [FromBody] LogStepsRequest request)
    {
        var result = await _activities.LogDailyStepsAsync(userId, request.Steps);
        if (result.IsNotFound)
            return NotFound(new { error = result.Error });
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new
        {
            todayTotalSteps = result.TodayTotalSteps,
            pointsEarned = result.PointsEarned,
            xpEarned = result.XpEarned,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter DailyStepsControllerTests`
Expected: PASS (all 8 cases, including the `[Theory]` rows).

- [ ] **Step 8: Commit**

```bash
git add backend/Sport4You.Api/DTOs/LogStepsRequest.cs \
        backend/Sport4You.Api/Services/IActivityService.cs \
        backend/Sport4You.Api/Services/ActivityService.cs \
        backend/Sport4You.Api/Controllers/UsersController.cs \
        backend/Sport4You.Tests/DailyStepsControllerTests.cs
git commit -m "feat: add per-day accumulating steps endpoint POST /api/users/{id}/steps"
```

---

## Task 3: Reject `daily_steps` on `POST /api/activities`

**Files:**
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs` (`ValidateSportMetrics`)
- Modify: `backend/Sport4You.Tests/ActivitiesControllerTests.cs` (repurpose the existing steps test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /api/activities` with `steps` (and no sport) now returns 400 with an error mentioning the steps endpoint.

- [ ] **Step 1: Update the existing test to expect rejection**

In `backend/Sport4You.Tests/ActivitiesControllerTests.cs`, replace the body of `LogActivity_StepsWithoutSport_ReturnsDailyStepsPoints` and rename it:

```csharp
    [Fact]
    public async Task LogActivity_Steps_IsRejected()
    {
        var userId = await CreateUserAsync("Step", "Per");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            steps = 1000
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("steps", body!["error"], StringComparison.OrdinalIgnoreCase);
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter LogActivity_Steps_IsRejected`
Expected: FAIL — the endpoint still returns 200.

- [ ] **Step 3: Reject steps in `ValidateSportMetrics`**

In `ActivityService.cs`, change the steps branch of `ValidateSportMetrics`. Replace:

```csharp
        if (r.Steps.HasValue && sport == null)
        {
            if (r.Distance.HasValue || r.Duration != null)
                return (false, "Steps activity cannot include distance or duration", string.Empty);
            return (true, null, "daily_steps");
        }
```

with:

```csharp
        if (r.Steps.HasValue && sport == null)
            return (false, "Daily steps must be logged via POST /api/users/{userId}/steps", string.Empty);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter LogActivity_Steps_IsRejected`
Expected: PASS.

- [ ] **Step 5: Run the whole backend suite (guard against regressions)**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj`
Expected: PASS. (Unit tests for `ScoringService`/`XpService` still call the pure `CalculatePoints`/`CalculateActivityXp` for `daily_steps` directly — those formulas are unchanged and remain valid.)

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/ActivityService.cs backend/Sport4You.Tests/ActivitiesControllerTests.cs
git commit -m "feat: route daily steps only through the steps endpoint, reject on /api/activities"
```

---

## Task 4: Expose `TodaySteps` on the dashboard

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs`
- Modify: `backend/Sport4You.Api/Services/DashboardService.cs`
- Test: `backend/Sport4You.Tests/DailyStepsControllerTests.cs` (add one case)

**Interfaces:**
- Consumes: existing `activities` list in `DashboardService.GetDashboardAsync`.
- Produces: `DashboardDto.TodaySteps` (int) — the current UTC day's `daily_steps` total, `0` if none. Serialized as `todaySteps`.

- [ ] **Step 1: Write the failing test**

Add to `DailyStepsControllerTests.cs`:

```csharp
    [Fact]
    public async Task Dashboard_TodaySteps_ReflectsAccumulatedTotal()
    {
        var userId = await CreateUserAsync("Step", "Dash");
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 6000 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 1500 });

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");

        Assert.Equal(7500, dash!["todaySteps"].GetInt32());
    }

    [Fact]
    public async Task Dashboard_TodaySteps_ZeroWhenNoneToday()
    {
        var userId = await CreateUserAsync("Step", "None");

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");

        Assert.Equal(0, dash!["todaySteps"].GetInt32());
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter Dashboard_TodaySteps`
Expected: FAIL — `todaySteps` key missing (KeyNotFoundException).

- [ ] **Step 3: Add the DTO field**

In `DashboardDto.cs`, add to `DashboardDto`:

```csharp
    public int TodaySteps { get; set; }
```

- [ ] **Step 4: Populate it in `DashboardService`**

In `DashboardService.GetDashboardAsync`, after `activities` is fetched, compute today's total and set it on the returned DTO. Add this near the other local computations:

```csharp
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        var todaySteps = activities
            .Where(a => a.Sport == "daily_steps" && a.DateTime >= todayStart && a.DateTime < todayEnd)
            .Sum(a => a.Steps ?? 0);
```

Then add to the `new DashboardDto { ... }` initializer:

```csharp
            TodaySteps = todaySteps,
```

- [ ] **Step 5: Run to verify pass**

Run: `dotnet test backend/Sport4You.Tests/Sport4You.Tests.csproj --filter Dashboard_TodaySteps`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/DTOs/DashboardDto.cs \
        backend/Sport4You.Api/Services/DashboardService.cs \
        backend/Sport4You.Tests/DailyStepsControllerTests.cs
git commit -m "feat: expose today's step total on the dashboard DTO"
```

---

## Task 5: Extract shared `UnlockSplashComponent`

**Files:**
- Create: `frontend/src/app/shared/components/unlock-splash/unlock-splash.component.ts`
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: `UnlockedAchievement`, `UnlockedAvatar` from `../../models/dashboard.model`; `achievementIconPath` from `../../utils/achievement-icon`.
- Produces: `UnlockSplashComponent`, selector `app-unlock-splash`, inputs `@Input() achievements: UnlockedAchievement[]` and `@Input() avatars: UnlockedAvatar[]`, output `@Output() finished = new EventEmitter<void>()`. It renders the queued achievement then avatar full-bleed splashes (absolutely positioned, `z-index:50`, filling its host), runs the XP count-up, and emits `finished` once both queues drain. It renders nothing when both inputs are empty.

The goal is a behavior-preserving extraction: the achievement + avatar splash markup, their styles, the queue state, the XP ticker, `nextAchievement`, `nextAvatar`, `rarityLabel`, and `achievementArt` move out of the dialog into this component. The dialog's confirmation splash (`.conf-splash`, video) stays in the dialog.

- [ ] **Step 1: Create the component**

Create `frontend/src/app/shared/components/unlock-splash/unlock-splash.component.ts` with the markup and styles lifted verbatim from the dialog (the two `@for` splash blocks and the `unlock splash` style section), wired to inputs/queues:

```typescript
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnlockedAchievement, UnlockedAvatar } from '../../models/dashboard.model';
import { achievementIconPath } from '../../utils/achievement-icon';

@Component({
  selector: 'app-unlock-splash',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { position:absolute; inset:0; display:block; pointer-events:none; z-index:50; }
    :host ::ng-deep .splash, .splash { pointer-events:auto; }

    @keyframes s4y-conf { 0%{transform:translateY(-14px) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(360px) rotate(420deg);opacity:0} }

    /* unlock splash (achievements + avatars) */
    .splash {
      position:absolute; inset:0; border-radius:34px; z-index:50;
      overflow:hidden; display:flex; flex-direction:column; justify-content:flex-end;
      background:#0e1a34;
    }
    .splash-art {
      position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
      animation:s4y-kenburns 8s ease-out both;
    }
    @keyframes s4y-kenburns { from { transform:scale(1); } to { transform:scale(1.12); } }
    .splash-wash { position:absolute; inset:0; }
    .splash-wash.bronze { background:linear-gradient(180deg, transparent 38%, rgba(74,42,10,.82) 72%, rgba(46,24,4,.97)); }
    .splash-wash.silver { background:linear-gradient(180deg, transparent 38%, rgba(42,52,70,.82) 72%, rgba(20,28,42,.97)); }
    .splash-wash.gold   { background:linear-gradient(180deg, transparent 38%, rgba(96,62,0,.82) 72%, rgba(58,36,0,.97)); }
    .splash-wash.blue   { background:linear-gradient(180deg, transparent 38%, rgba(23,59,146,.82) 72%, rgba(12,30,74,.97)); }
    .splash-flash { position:absolute; inset:0; z-index:60; pointer-events:none; animation:s4y-flash .4s ease-out both; }
    .splash-flash.bronze { background:#F5D3A3; }
    .splash-flash.silver { background:#E8EEF7; }
    .splash-flash.gold   { background:#FDE9A7; }
    .splash-flash.blue   { background:#9db3dd; }
    @keyframes s4y-flash { from { opacity:.9; } to { opacity:0; } }
    .splash-shimmer {
      position:absolute; inset:0; z-index:55; pointer-events:none;
      background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,.4) 48%, transparent 60%);
      background-size:220% 100%; animation:s4y-shimmer 1.6s ease-out .3s both;
    }
    @keyframes s4y-shimmer { from { background-position:220% 0; } to { background-position:-120% 0; } }
    .splash-content { position:relative; z-index:58; padding:0 30px 28px; }
    .splash-item { animation:s4y-rise .5s cubic-bezier(.2,.7,.3,1) both; }
    @keyframes s4y-rise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
    .splash-tag { font-family:'Chakra Petch',sans-serif; font-size:11px; letter-spacing:.28em; font-weight:700; color:#C6E63B; text-shadow:0 0 14px rgba(198,230,59,.6); margin-bottom:8px; }
    .splash-tier { font-family:'Chakra Petch',sans-serif; font-size:12px; letter-spacing:.24em; font-weight:700; margin-bottom:6px; }
    .splash-tier.bronze { color:#F5D3A3; }
    .splash-tier.silver { color:#dfe7f2; }
    .splash-tier.gold   { color:#FDE9A7; }
    .splash-name { font-family:'Chakra Petch',sans-serif; font-size:32px; font-weight:700; color:#fff; line-height:1.05; margin-bottom:6px; text-shadow:0 4px 18px rgba(0,0,0,.5); }
    .splash-desc { font-family:'Nunito',sans-serif; font-size:14px; color:rgba(255,255,255,.85); margin-bottom:10px; max-width:300px; }
    .splash-xp { font-family:'Chakra Petch',sans-serif; font-size:22px; font-weight:700; color:#C6E63B; letter-spacing:.05em; margin-bottom:16px; text-shadow:0 0 16px rgba(198,230,59,.5); }
    .splash-confetti { position:absolute; border-radius:2px; z-index:57; }
    .ach-next  {
      background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px;
      letter-spacing:.05em; padding:13px 34px; border-radius:14px;
      cursor:pointer; border:none; box-shadow:0 6px 0 #7c9c00;
      transition:transform .1s, box-shadow .1s;
    }
    .ach-next:active { transform:translateY(3px); box-shadow:0 3px 0 #7c9c00; }
  `],
  template: `
    <!-- Achievement unlock splash (queued) -->
    @for (ach of currentAchievement ? [currentAchievement] : []; track ach.id) {
    <div class="splash">
      <img class="splash-art" [src]="achievementArt(ach)" [alt]="ach.name">
      <div class="splash-wash" [class]="ach.tier"></div>
      @if (ach.tier === 'gold') { <div class="splash-shimmer"></div> }
      <div class="splash-flash" [class]="ach.tier"></div>
      <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
      <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
      <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
      <div class="splash-confetti" style="left:84%;top:11%;width:10px;height:10px;background:#C6E63B;border-radius:50%;animation:s4y-conf 3.1s ease-in .1s infinite;"></div>
      <div class="splash-confetti" style="left:26%;top:4%;width:9px;height:9px;background:#FFD54A;animation:s4y-conf 2.6s ease-in .7s infinite;"></div>
      <div class="splash-content">
        <div class="splash-item splash-tag" style="animation-delay:.15s">ACHIEVEMENT UNLOCKED</div>
        <div class="splash-item splash-tier" [class]="ach.tier" style="animation-delay:.23s">
          {{ ach.tier.toUpperCase() }} · {{ rarityLabel(ach.tier) }}
        </div>
        <div class="splash-item splash-name" style="animation-delay:.31s">{{ ach.name }}</div>
        <div class="splash-item splash-desc" style="animation-delay:.39s">{{ ach.description }}</div>
        <div class="splash-item splash-xp" style="animation-delay:.47s">+{{ displayedXp }} XP</div>
        <button class="splash-item ach-next" style="animation-delay:.55s" (click)="nextAchievement()">
          {{ achievementQueue.length > 0 ? 'NEXT →' : 'AWESOME!' }}
        </button>
      </div>
    </div>
    }

    <!-- Avatar unlock splash (after achievements) -->
    @for (av of currentAvatar ? [currentAvatar] : []; track av.id) {
    <div class="splash">
      <img class="splash-art" [src]="av.imagePath" [alt]="av.name">
      <div class="splash-wash blue"></div>
      <div class="splash-flash blue"></div>
      <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
      <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
      <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
      <div class="splash-content">
        <div class="splash-item splash-tag" style="animation-delay:.15s">AVATAR UNLOCKED</div>
        <div class="splash-item splash-name" style="animation-delay:.23s">{{ av.name }}</div>
        <div class="splash-item splash-desc" style="animation-delay:.31s">{{ av.description }}</div>
        <button class="splash-item ach-next" style="animation-delay:.39s" (click)="nextAvatar()">
          {{ avatarQueue.length > 0 ? 'NEXT →' : 'NICE!' }}
        </button>
      </div>
    </div>
    }
  `,
})
export class UnlockSplashComponent implements OnChanges {
  @Input() achievements: UnlockedAchievement[] = [];
  @Input() avatars: UnlockedAvatar[] = [];
  @Output() finished = new EventEmitter<void>();

  currentAchievement: UnlockedAchievement | null = null;
  achievementQueue: UnlockedAchievement[] = [];
  currentAvatar: UnlockedAvatar | null = null;
  avatarQueue: UnlockedAvatar[] = [];
  displayedXp = 0;

  private xpRaf = 0;

  ngOnChanges(_: SimpleChanges): void {
    const achievements = this.achievements ?? [];
    const avatars = this.avatars ?? [];
    if (achievements.length > 0) {
      this.currentAchievement = achievements[0];
      this.achievementQueue = achievements.slice(1);
      this.avatarQueue = avatars;          // shown after achievements dismissed
      this.startXpTicker(achievements[0].xpReward);
    } else if (avatars.length > 0) {
      this.currentAvatar = avatars[0];
      this.avatarQueue = avatars.slice(1);
    } else {
      this.finished.emit();
    }
  }

  nextAchievement(): void {
    this.currentAchievement = this.achievementQueue.shift() ?? null;
    if (this.currentAchievement) {
      this.startXpTicker(this.currentAchievement.xpReward);
    } else if (this.avatarQueue.length > 0) {
      this.currentAvatar = this.avatarQueue.shift() ?? null;
    } else {
      this.finished.emit();
    }
  }

  nextAvatar(): void {
    this.currentAvatar = this.avatarQueue.shift() ?? null;
    if (!this.currentAvatar) this.finished.emit();
  }

  rarityLabel(tier: string): string {
    return { bronze: 'COMMON', silver: 'RARE', gold: 'LEGENDARY' }[tier] ?? '';
  }

  achievementArt(a: UnlockedAchievement): string {
    return achievementIconPath(a);
  }

  private startXpTicker(target: number): void {
    cancelAnimationFrame(this.xpRaf);
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      this.displayedXp = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) this.xpRaf = requestAnimationFrame(tick);
    };
    this.xpRaf = requestAnimationFrame(tick);
  }
}
```

- [ ] **Step 2: Refactor the dialog to use the component**

In `log-activity-dialog.component.ts`:

1. Add the import:

```typescript
import { UnlockSplashComponent } from '../unlock-splash/unlock-splash.component';
```

2. Add `UnlockSplashComponent` to the `@Component({ imports: [...] })` array.

3. Remove the two `@for` unlock-splash blocks from the template (the `<!-- Achievement unlock splash -->` and `<!-- Avatar unlock splash -->` `@for` blocks) and replace them, at the same place (inside `.card`, after the conf-splash block), with:

```html
      <app-unlock-splash
        [achievements]="unlockedAchievements"
        [avatars]="unlockedAvatars"
        (finished)="onUnlocksFinished()"></app-unlock-splash>
```

4. In the class, remove the now-unused members that moved into the component: `currentAchievement`, `achievementQueue`, `currentAvatar`, `avatarQueue`, `displayedXp`, `startXpTicker`, `nextAchievement`, `nextAvatar`, `rarityLabel`, `achievementArt`. (Keep `startCountUp` — the conf-splash still uses `displayedPoints`.)

5. Add two arrays the template binds to, and populate them in `logActivity`'s success handler. Replace the block that currently sets `currentAchievement`/`achievementQueue`/`avatarQueue` with:

```typescript
        this.unlockedAchievements = res.achievementsUnlocked ?? [];
        this.unlockedAvatars = res.avatarsUnlocked ?? [];
```

Declare the fields:

```typescript
  unlockedAchievements: UnlockedAchievement[] = [];
  unlockedAvatars: UnlockedAvatar[] = [];
```

6. Add the finished handler (no-op beyond letting the conf-splash's DONE remain; overlays hide themselves once queues drain):

```typescript
  onUnlocksFinished(): void { /* conf-splash DONE button remains for the user */ }
```

7. Remove the now-unused `.splash*` / `.ach-next` / unlock-splash style rules and the `s4y-kenburns`, `s4y-flash`, `s4y-shimmer`, `s4y-rise` keyframes from the dialog's `styles`. Keep everything the conf-splash and picker still use (`.conf-splash`, `.splash-video`, `.splash-pose`, `.splash-wash.dark`, `.splash-flash.lime`, `.splash-confetti`, `.splash-content`, `.splash-item`, `.splash-tag`, and the `s4y-conf`/`s4y-pop`/`s4y-glow` keyframes — note `.conf-splash` reuses `.splash-content`, `.splash-item`, `.splash-tag`, `.splash-confetti`, so keep those).

- [ ] **Step 3: Verify the frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build completes with no errors. If the compiler reports unused/undeclared members, reconcile against steps above (a leftover reference to a removed field is the likely cause).

- [ ] **Step 4: Manual smoke check**

Start the backend (`dotnet run --project backend/Sport4You.Api`) and frontend (`cd frontend && npm start`). Log an activity that unlocks an achievement (e.g. a long run for a first-time user). Confirm the achievement splash still appears over the confirmation splash and dismisses through to DONE exactly as before.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/unlock-splash/unlock-splash.component.ts \
        frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts
git commit -m "refactor: extract shared UnlockSplashComponent from log-activity dialog"
```

---

## Task 6: Frontend models + `ApiService.addSteps`

**Files:**
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`

**Interfaces:**
- Consumes: existing `CompletedMission`, `UnlockedAchievement`, `UnlockedAvatar`.
- Produces:
  - `DashboardData.todaySteps: number`.
  - `interface AddStepsResponse { todayTotalSteps: number; pointsEarned: number; xpEarned: number; missionsCompleted: CompletedMission[]; achievementsUnlocked: UnlockedAchievement[]; avatarsUnlocked: UnlockedAvatar[]; }`.
  - `ApiService.addSteps(userId: string, steps: number): Observable<AddStepsResponse>`.

- [ ] **Step 1: Add `todaySteps` to `DashboardData`**

In `dashboard.model.ts`, add to the `DashboardData` interface (alongside `currentStreak`):

```typescript
  todaySteps: number;
```

- [ ] **Step 2: Add the `AddStepsResponse` interface**

At the end of `dashboard.model.ts`:

```typescript
export interface AddStepsResponse {
  todayTotalSteps: number;
  pointsEarned: number;
  xpEarned: number;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
  avatarsUnlocked: UnlockedAvatar[];
}
```

- [ ] **Step 3: Add the API method**

In `api.service.ts`, add `AddStepsResponse` to the model import block, and add the method inside the class (after `logActivity`):

```typescript
  addSteps(userId: string, steps: number): Observable<AddStepsResponse> {
    return this.http.post<AddStepsResponse>(`${this.base}/users/${userId}/steps`, { steps });
  }
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/models/dashboard.model.ts frontend/src/app/shared/services/api.service.ts
git commit -m "feat: add addSteps API method and todaySteps dashboard field"
```

---

## Task 7: Remove `daily_steps` from the sport pickers

**Files:**
- Modify: `frontend/src/app/shared/constants/sport.constants.ts`
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SPORTS` (in `sport.constants.ts`) and the dialog's internal `SPORTS: Sport[]` no longer include `daily_steps`. `SPORT_COLORS` and `SPORT_ICON_NAMES` keep their `daily_steps` entries (still used to render historical step rows in charts and the activity feed).

- [ ] **Step 1: Remove from the shared `SPORTS` constant**

In `sport.constants.ts`, change:

```typescript
export const SPORTS = [
  'running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps',
] as const;
```

to:

```typescript
export const SPORTS = [
  'running', 'walking', 'cycling', 'swimming', 'gym',
] as const;
```

Leave `SPORT_COLORS` and `SPORT_ICON_NAMES` unchanged (their `daily_steps` entries are still needed).

- [ ] **Step 2: Remove from the dialog's sport list**

In `log-activity-dialog.component.ts`, delete the `daily_steps` entry from the `const SPORTS: Sport[] = [ ... ]` array (the line beginning `{ key:'daily_steps', name:'Daily Steps', ...`). The dialog's steps-only branch in `logActivity` (`else { delete req.sport; req.steps = val; }`) is now unreachable via the UI; leave the method otherwise intact — the picker simply no longer offers steps.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: Build completes with no errors.

- [ ] **Step 4: Manual smoke check**

Open the Log Activity dialog; confirm the sport carousel cycles through the five remaining sports and never shows Daily Steps. Confirm the dashboard activity feed still renders any historical step rows with their icon/color.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/constants/sport.constants.ts \
        frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts
git commit -m "feat: remove daily steps from the Log Activity sport pickers"
```

---

## Task 8: `TodayStepsCard` widget on the dashboard

**Files:**
- Create: `frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `ApiService.addSteps` (Task 6), `AddStepsResponse`, `DashboardData.todaySteps` (Task 6), `UnlockSplashComponent` (Task 5), `MatSnackBar`.
- Produces: `TodayStepsCardComponent`, selector `app-today-steps-card`, input `@Input() todaySteps = 0`, output `@Output() stepsAdded = new EventEmitter<void>()`. Renders today's total, a progress ring toward a 10,000-step goal, points-from-steps today, and an input + "Add steps" button that posts to the endpoint, shows mission snackbars, plays unlock splashes via `UnlockSplashComponent`, and emits `stepsAdded` so the dashboard reloads.

- [ ] **Step 1: Create the widget**

Create `frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts`:

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { UnlockSplashComponent } from '../../shared/components/unlock-splash/unlock-splash.component';
import { UnlockedAchievement, UnlockedAvatar } from '../../shared/models/dashboard.model';

const STEP_GOAL = 10000;

@Component({
  selector: 'app-today-steps-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, UnlockSplashComponent],
  styles: [`
    :host { display:block; }
    .card {
      position:relative; overflow:hidden;
      background:linear-gradient(180deg,#12213f,#0e1a34);
      border:1px solid rgba(122,150,210,.18); border-radius:20px;
      padding:20px 22px;
    }
    .title { font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; letter-spacing:.2em; color:#7fa8ff; margin-bottom:14px; }
    .ring-row { display:flex; align-items:center; gap:18px; }
    .ring { --p:0; width:104px; height:104px; border-radius:50%; flex-shrink:0;
      background:conic-gradient(#C6E63B calc(var(--p)*1%), rgba(255,255,255,.08) 0);
      display:flex; align-items:center; justify-content:center; }
    .ring-inner { width:80px; height:80px; border-radius:50%; background:#0e1a34; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .ring-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#fff; line-height:1; }
    .ring-goal { font-size:10px; color:#7fa8ff; margin-top:2px; }
    .meta { flex:1; }
    .pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; color:#C6E63B; }
    .pts-sub { font-size:12px; color:#9fb2d6; margin-top:2px; }
    .add-row { display:flex; gap:8px; margin-top:16px; }
    .add-input { flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(122,150,210,.2); border-radius:10px; padding:9px 12px; color:#fff; font-family:'Nunito',sans-serif; font-size:14px; }
    .add-input::placeholder { color:#6f86b3; }
    .add-btn { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; border:none; border-radius:10px; padding:9px 18px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; letter-spacing:.05em; cursor:pointer; }
    .add-btn:disabled { opacity:.5; cursor:default; }
    .err { color:#ff8a80; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="card">
      <div class="title">TODAY'S STEPS</div>
      <div class="ring-row">
        <div class="ring" [style.--p]="progressPercent">
          <div class="ring-inner">
            <div class="ring-val">{{ todaySteps.toLocaleString('en-US') }}</div>
            <div class="ring-goal">/ {{ goal.toLocaleString('en-US') }}</div>
          </div>
        </div>
        <div class="meta">
          <div class="pts">+{{ pointsFromSteps }} PTS</div>
          <div class="pts-sub">earned from steps today</div>
        </div>
      </div>
      <div class="add-row">
        <input class="add-input" type="number" inputmode="numeric" min="1"
               placeholder="Add steps…" [(ngModel)]="entry" [disabled]="loading"
               (keyup.enter)="add()">
        <button class="add-btn" [disabled]="loading" (click)="add()">ADD</button>
      </div>
      <div class="err" *ngIf="errorMsg">{{ errorMsg }}</div>

      <app-unlock-splash
        [achievements]="unlockedAchievements"
        [avatars]="unlockedAvatars"
        (finished)="onUnlocksFinished()"></app-unlock-splash>
    </div>
  `,
})
export class TodayStepsCardComponent {
  @Input() todaySteps = 0;
  @Output() stepsAdded = new EventEmitter<void>();

  readonly goal = STEP_GOAL;
  entry: number | null = null;
  loading = false;
  errorMsg = '';
  unlockedAchievements: UnlockedAchievement[] = [];
  unlockedAvatars: UnlockedAvatar[] = [];

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  get progressPercent(): number {
    return Math.min(100, Math.round((this.todaySteps / this.goal) * 100));
  }

  get pointsFromSteps(): number {
    return Math.floor(this.todaySteps / 100);
  }

  add(): void {
    const userId = localStorage.getItem('userId');
    const steps = Math.floor(Number(this.entry));
    if (!userId) return;
    if (!steps || steps <= 0) { this.errorMsg = 'Enter a step count above zero.'; return; }
    if (steps > 100000) { this.errorMsg = 'Max 100,000 steps per entry.'; return; }

    this.loading = true; this.errorMsg = '';
    this.api.addSteps(userId, steps).subscribe({
      next: res => {
        this.loading = false;
        this.entry = null;
        this.todaySteps = res.todayTotalSteps;

        res.missionsCompleted.forEach((m, i) => {
          setTimeout(() => {
            this.snackBar.open(
              `Quest complete! ${m.description} · +${m.xpEarned} XP`,
              '', { duration: 3500, panelClass: 's4y-toast' });
          }, i * 600);
        });

        this.unlockedAchievements = res.achievementsUnlocked;
        this.unlockedAvatars = res.avatarsUnlocked;

        this.stepsAdded.emit();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Failed to add steps. Please try again.';
      },
    });
  }

  onUnlocksFinished(): void {
    this.unlockedAchievements = [];
    this.unlockedAvatars = [];
  }
}
```

- [ ] **Step 2: Mount it on the dashboard**

In `dashboard.component.ts`:

1. Add imports:

```typescript
import { TodayStepsCardComponent } from './today-steps-card/today-steps-card.component';
```

2. Add `TodayStepsCardComponent` to the component's `imports` array.

3. In the template, place the widget where a dashboard card fits (e.g. alongside the streak/mission cards in the sidebar column). Bind the current total and reload on add:

```html
        <app-today-steps-card
          [todaySteps]="data?.todaySteps ?? 0"
          (stepsAdded)="loadData()"></app-today-steps-card>
```

The dashboard's loaded-data variable is the nullable `data` (the same object the template accesses as `data?.currentStreak`, `data!.rank`, `data?.xp`, etc.), so guard with `data?.todaySteps ?? 0`. `loadData()` is the existing reload method the log dialog already calls on close (`ref.afterClosed().subscribe(... this.loadData())`).

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: Build completes with no errors.

- [ ] **Step 4: Manual smoke check**

With backend + frontend running: on the dashboard, the Today's Steps card shows the seeded/current total and ring. Add 3,000 steps → the total and ring update, points-from-steps updates, and the dashboard hero points/leaderboard reflect the new total after reload. Add steps again the same session → it accumulates (does not reset). If an entry triggers an achievement, the unlock splash plays over the card.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/today-steps-card/today-steps-card.component.ts \
        frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat: add Today's Steps dashboard widget"
```

---

## Self-Review Notes

- **Spec coverage:** accumulate-per-day (Task 2) · UTC day boundary (Tasks 2, 4) · points/XP deltas with floor correctness (Task 2 tests) · one row per day (Task 2 test) · `/api/activities` rejects steps (Task 3) · `TodaySteps` on dashboard (Task 4) · dedicated widget (Task 8) · steps removed from Log Activity dialog (Task 7) · unlock splashes reused via extraction (Tasks 5, 8) · validation `0 < steps <= 100_000` (Task 2 tests, Task 8 client guard) · seed data untouched (no task modifies `DataSeeder`).
- **Type consistency:** `LogDailyStepsAsync(Guid, int) → StepsResult` used identically in Task 2 service/controller; JSON keys `todayTotalSteps`/`pointsEarned`/`xpEarned` match `AddStepsResponse` (Task 6) and the widget (Task 8); `UnlockSplashComponent` inputs `achievements`/`avatars` + output `finished` are consumed identically by the dialog (Task 5) and the widget (Task 8).
- **XP delta correctness:** `AwardGenericXpAsync` (already on `IXpService`) awards the explicit computed delta, so accumulation across floor boundaries is exact — `CalculateActivityXp` is never called with the delta step count (which would misround).
