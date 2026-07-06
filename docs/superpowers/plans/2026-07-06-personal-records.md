# Personal Records Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Personal Records" section to a user's own profile page showing per-sport bests, the biggest single-day point haul, and the longest streak ever achieved.

**Architecture:** A new `PersonalRecordsService` computes everything on demand from the existing `IActivityRepository.GetByUserIdAsync(userId)` call — no schema changes, no write-pipeline changes. A new controller endpoint exposes it. The frontend adds one new standalone component embedded in the existing profile page, gated behind the already-existing `isOwnProfile` check.

**Tech Stack:** ASP.NET Core 8 / EF Core / SQLite (backend), Angular 17 standalone components (frontend), xUnit + `WebApplicationFactory` (backend tests).

## Global Constraints

- No changes to `POST /api/users` or `POST /api/activities` request/response shapes (assignment contracts).
- No database schema changes — everything is computed from existing `Activity` rows via `GetByUserIdAsync`.
- Visible only when `isOwnProfile` is true — never on another user's public profile.
- Sport records: running/walking/cycling use max `Distance`; swimming/gym use max `Duration` (mm:ss, compared as total seconds); daily_steps uses max `Steps`. A sport with zero logged activities is omitted from the results entirely (no zero/placeholder record).
- "Biggest single-day point haul" groups by `a.DateTime.Date` (same grouping `DashboardService.GetDashboardAsync` already uses for `pointsOverTime` — see `backend/Sport4You.Api/Services/DashboardService.cs:61-69`), summed by `Points`, taking the max day. Do NOT use `ToUniversalTime()` for this grouping — that would produce a different calendar day than the heatmap the user already sees.
- "Longest streak ever" reuses `ActivityStreakHelper`'s existing `DateOnly.FromDateTime(d.ToUniversalTime())` grouping convention (see `backend/Sport4You.Api/Services/ActivityStreakHelper.cs:6-27`) — consistent with the existing `ComputeCurrentStreak`, not with the point-haul grouping above. These two records intentionally use different day-boundary conventions because they build on different existing helpers; do not "fix" this inconsistency as part of this plan.

---

### Task 1: Backend — `ActivityStreakHelper.ComputeLongestStreakEver`

**Files:**
- Modify: `backend/Sport4You.Api/Services/ActivityStreakHelper.cs`
- Test: `backend/Sport4You.Tests/ActivityStreakHelperTests.cs` (new)

**Interfaces:**
- Produces: `internal static int ComputeLongestStreakEver(IEnumerable<DateTime> activityDateTimes)` on `ActivityStreakHelper`.

- [ ] **Step 1: Write the failing tests**

Create `backend/Sport4You.Tests/ActivityStreakHelperTests.cs`:

```csharp
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ActivityStreakHelperTests
{
    [Fact]
    public void ComputeLongestStreakEver_NoActivities_ReturnsZero()
    {
        var result = ActivityStreakHelper.ComputeLongestStreakEver(new List<DateTime>());
        Assert.Equal(0, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_SingleDay_ReturnsOne()
    {
        var dates = new List<DateTime> { new DateTime(2026, 1, 1) };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(1, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_HistoricalStreakLongerThanCurrent_ReturnsHistoricalMax()
    {
        // A 5-day streak in the past (Jan 1-5), then a gap, then a 2-day
        // streak ending "today" (Jan 20). The longest-ever streak (5) must
        // beat the current active streak (2) — proves this isn't just
        // reusing ComputeCurrentStreak's early-exit behavior.
        var today = DateTime.UtcNow.Date;
        var dates = new List<DateTime>
        {
            new DateTime(2026, 1, 1), new DateTime(2026, 1, 2), new DateTime(2026, 1, 3),
            new DateTime(2026, 1, 4), new DateTime(2026, 1, 5),
            today.AddDays(-1), today,
        };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(5, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_MultipleActivitiesSameDay_CountsDayOnce()
    {
        var dates = new List<DateTime>
        {
            new DateTime(2026, 1, 1, 8, 0, 0), new DateTime(2026, 1, 1, 18, 0, 0),
            new DateTime(2026, 1, 2, 9, 0, 0),
        };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(2, result);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ActivityStreakHelperTests`
Expected: FAIL — `ComputeLongestStreakEver` does not exist (compile error).

- [ ] **Step 3: Implement `ComputeLongestStreakEver`**

Edit `backend/Sport4You.Api/Services/ActivityStreakHelper.cs` — add this method inside the existing `internal static class ActivityStreakHelper`, after `ComputeCurrentStreak`:

```csharp
    internal static int ComputeLongestStreakEver(IEnumerable<DateTime> activityDateTimes)
    {
        var dates = activityDateTimes
            .Select(d => DateOnly.FromDateTime(d.ToUniversalTime()))
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        if (dates.Count == 0) return 0;

        var longest = 1;
        var current = 1;
        for (var i = 1; i < dates.Count; i++)
        {
            if (dates[i] == dates[i - 1].AddDays(1))
            {
                current++;
                if (current > longest) longest = current;
            }
            else
            {
                current = 1;
            }
        }
        return longest;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter ActivityStreakHelperTests`
Expected: PASS — 4/4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/Sport4You.Api/Services/ActivityStreakHelper.cs backend/Sport4You.Tests/ActivityStreakHelperTests.cs
git commit -m "feat: add longest-streak-ever calculation"
```

---

### Task 2: Backend — `PersonalRecordsDto` and `PersonalRecordsService`

**Files:**
- Create: `backend/Sport4You.Api/DTOs/PersonalRecordsDto.cs`
- Create: `backend/Sport4You.Api/Services/IPersonalRecordsService.cs`
- Create: `backend/Sport4You.Api/Services/PersonalRecordsService.cs`
- Modify: `backend/Sport4You.Api/Program.cs`
- Test: `backend/Sport4You.Tests/PersonalRecordsServiceTests.cs` (new)

**Interfaces:**
- Consumes: `IActivityRepository.GetByUserIdAsync(Guid userId)` → `Task<List<Activity>>` (existing, `backend/Sport4You.Api/Repositories/IActivityRepository.cs:9`). `Activity` has `DateTime DateTime`, `string Sport`, `decimal? Distance`, `string? Duration`, `int? Steps`, `int Points` (`backend/Sport4You.Api/Models/Activity.cs`). `ActivityStreakHelper.ComputeLongestStreakEver(IEnumerable<DateTime>)` from Task 1.
- Produces: `PersonalRecordsDto` record, `IPersonalRecordsService.GetRecordsAsync(Guid userId)` → `Task<PersonalRecordsDto>`, used by Task 3's controller.

- [ ] **Step 1: Write the DTO**

Create `backend/Sport4You.Api/DTOs/PersonalRecordsDto.cs`:

```csharp
namespace Sport4You.Api.DTOs;

public record SportRecordDto(string Sport, decimal? BestDistance, string? BestDuration, int? BestSteps, DateTime AchievedAt);

public record PersonalRecordsDto(
    List<SportRecordDto> SportRecords,
    int BestDayPoints,
    DateTime? BestDayDate,
    int LongestStreakEver);
```

- [ ] **Step 2: Write the failing tests**

Create `backend/Sport4You.Tests/PersonalRecordsServiceTests.cs`. This uses the same `TestFactory` + HTTP-client pattern as `backend/Sport4You.Tests/Helpers/TestFactory.cs` and the `CreateUserAsync` helper used across the suite (e.g. in `LeaderboardControllerTests.cs`), but tests `PersonalRecordsService` directly against a real `AppDbContext` obtained from the factory's service provider — this lets us construct `Activity` rows directly with exact `DateTime`/`Points` values instead of going through the scoring pipeline.

```csharp
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class PersonalRecordsServiceTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;

    public PersonalRecordsServiceTests(TestFactory factory)
    {
        _factory = factory;
    }

    private (IPersonalRecordsService service, AppDbContext db, Guid userId) CreateScope()
    {
        var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IPersonalRecordsService>();
        var user = new User { Id = Guid.NewGuid(), FirstName = $"Test{Guid.NewGuid():N}", LastName = "User" };
        db.Users.Add(user);
        db.SaveChanges();
        return (service, db, user.Id);
    }

    [Fact]
    public async Task GetRecordsAsync_NoActivities_ReturnsEmptyDefaults()
    {
        var (service, _, userId) = CreateScope();

        var result = await service.GetRecordsAsync(userId);

        Assert.Empty(result.SportRecords);
        Assert.Equal(0, result.BestDayPoints);
        Assert.Null(result.BestDayDate);
        Assert.Equal(0, result.LongestStreakEver);
    }

    [Fact]
    public async Task GetRecordsAsync_MultipleSports_ReturnsBestPerSport()
    {
        var (service, db, userId) = CreateScope();
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 1), Sport = "running", Distance = 5.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 2), Sport = "running", Distance = 10.2m, Points = 1020 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 3), Sport = "swimming", Duration = "30:00", Points = 450 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        var running = result.SportRecords.Single(r => r.Sport == "running");
        Assert.Equal(10.2m, running.BestDistance);
        Assert.Equal(new DateTime(2026, 1, 2), running.AchievedAt);

        var swimming = result.SportRecords.Single(r => r.Sport == "swimming");
        Assert.Equal("30:00", swimming.BestDuration);
    }

    [Fact]
    public async Task GetRecordsAsync_DurationComparedAsSeconds_PicksLongerDuration()
    {
        var (service, db, userId) = CreateScope();
        // 9:50 is shorter than 10:05 in total seconds, despite "9" > "1"
        // lexicographically — proves duration comparison is numeric, not string.
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 1), Sport = "gym", Duration = "9:50", Points = 50 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 2), Sport = "gym", Duration = "10:05", Points = 51 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        var gym = result.SportRecords.Single(r => r.Sport == "gym");
        Assert.Equal("10:05", gym.BestDuration);
    }

    [Fact]
    public async Task GetRecordsAsync_MultipleActivitiesSameDay_SumsIntoBestDay()
    {
        var (service, db, userId) = CreateScope();
        var day = new DateTime(2026, 2, 10);
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = day.AddHours(7), Sport = "running", Distance = 5.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = day.AddHours(18), Sport = "cycling", Distance = 20.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 2, 11), Sport = "running", Distance = 1.0m, Points = 100 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        Assert.Equal(1000, result.BestDayPoints);
        Assert.Equal(day.Date, result.BestDayDate);
    }

    [Fact]
    public async Task GetRecordsAsync_ReturnsLongestStreakEver()
    {
        var (service, db, userId) = CreateScope();
        var activities = new List<Activity>();
        for (var i = 0; i < 4; i++)
        {
            activities.Add(new Activity
            {
                Id = Guid.NewGuid(), UserId = userId,
                DateTime = new DateTime(2026, 1, 1).AddDays(i),
                Sport = "walking", Distance = 1.0m, Points = 50,
            });
        }
        db.Activities.AddRange(activities);
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        Assert.Equal(4, result.LongestStreakEver);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter PersonalRecordsServiceTests`
Expected: FAIL — `IPersonalRecordsService` does not exist (compile error).

- [ ] **Step 4: Write the service interface**

Create `backend/Sport4You.Api/Services/IPersonalRecordsService.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IPersonalRecordsService
{
    Task<PersonalRecordsDto> GetRecordsAsync(Guid userId);
}
```

- [ ] **Step 5: Implement the service**

Create `backend/Sport4You.Api/Services/PersonalRecordsService.cs`:

```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class PersonalRecordsService : IPersonalRecordsService
{
    private static readonly HashSet<string> DistanceSports = new() { "running", "walking", "cycling" };
    private static readonly HashSet<string> DurationSports = new() { "swimming", "gym" };

    private readonly IActivityRepository _activities;

    public PersonalRecordsService(IActivityRepository activities)
    {
        _activities = activities;
    }

    public async Task<PersonalRecordsDto> GetRecordsAsync(Guid userId)
    {
        var activities = await _activities.GetByUserIdAsync(userId);

        var sportRecords = new List<SportRecordDto>();
        foreach (var group in activities.GroupBy(a => a.Sport))
        {
            var sport = group.Key;
            if (DistanceSports.Contains(sport))
            {
                var best = group.OrderByDescending(a => a.Distance ?? 0).First();
                sportRecords.Add(new SportRecordDto(sport, best.Distance, null, null, best.DateTime));
            }
            else if (DurationSports.Contains(sport))
            {
                var best = group.OrderByDescending(a => ParseDurationSeconds(a.Duration)).First();
                sportRecords.Add(new SportRecordDto(sport, null, best.Duration, null, best.DateTime));
            }
            else if (sport == "daily_steps")
            {
                var best = group.OrderByDescending(a => a.Steps ?? 0).First();
                sportRecords.Add(new SportRecordDto(sport, null, null, best.Steps, best.DateTime));
            }
        }

        var bestDay = activities
            .GroupBy(a => a.DateTime.Date)
            .Select(g => new { Date = g.Key, Points = g.Sum(a => a.Points) })
            .OrderByDescending(x => x.Points)
            .FirstOrDefault();

        var longestStreakEver = ActivityStreakHelper.ComputeLongestStreakEver(activities.Select(a => a.DateTime));

        return new PersonalRecordsDto(
            sportRecords,
            bestDay?.Points ?? 0,
            bestDay?.Date,
            longestStreakEver);
    }

    private static int ParseDurationSeconds(string? duration)
    {
        if (string.IsNullOrEmpty(duration)) return 0;
        var parts = duration.Split(':');
        if (parts.Length != 2) return 0;
        if (!int.TryParse(parts[0], out var minutes)) return 0;
        if (!int.TryParse(parts[1], out var seconds)) return 0;
        return minutes * 60 + seconds;
    }
}
```

- [ ] **Step 6: Register the service in DI**

Edit `backend/Sport4You.Api/Program.cs` — add this line to the existing `builder.Services.AddScoped<...>()` block (after the `IRivalService` registration at line 24):

```csharp
builder.Services.AddScoped<IPersonalRecordsService, PersonalRecordsService>();
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter PersonalRecordsServiceTests`
Expected: PASS — 5/5 tests passing.

- [ ] **Step 8: Commit**

```bash
git add backend/Sport4You.Api/DTOs/PersonalRecordsDto.cs backend/Sport4You.Api/Services/IPersonalRecordsService.cs backend/Sport4You.Api/Services/PersonalRecordsService.cs backend/Sport4You.Api/Program.cs backend/Sport4You.Tests/PersonalRecordsServiceTests.cs
git commit -m "feat: add PersonalRecordsService computing per-sport, best-day, and streak records"
```

---

### Task 3: Backend — `PersonalRecordsController` endpoint

**Files:**
- Create: `backend/Sport4You.Api/Controllers/PersonalRecordsController.cs`
- Test: `backend/Sport4You.Tests/PersonalRecordsControllerTests.cs` (new)

**Interfaces:**
- Consumes: `IPersonalRecordsService.GetRecordsAsync(Guid userId)` → `Task<PersonalRecordsDto>` (from Task 2).
- Produces: `GET /api/users/{userId}/personal-records` → `200 OK` with JSON body matching `PersonalRecordsDto` (camelCase: `sportRecords`, `bestDayPoints`, `bestDayDate`, `longestStreakEver`; each `sportRecords` entry: `sport`, `bestDistance`, `bestDuration`, `bestSteps`, `achievedAt`). Consumed by Task 5's `ApiService.getPersonalRecords`.

- [ ] **Step 1: Write the failing test**

Create `backend/Sport4You.Tests/PersonalRecordsControllerTests.cs`, following the `CreateUserAsync` + `_client.PostAsJsonAsync("/api/activities", ...)` pattern used elsewhere in the test suite (e.g. `LeaderboardControllerTests.cs`):

```csharp
using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class PersonalRecordsControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public PersonalRecordsControllerTests(TestFactory factory)
    {
        _client = factory.CreateClient();
    }

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetPersonalRecords_NoActivities_ReturnsEmptyDefaults()
    {
        var userId = await CreateUserAsync("Records", "NoActivities");

        var response = await _client.GetAsync($"/api/users/{userId}/personal-records");
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<PersonalRecordsResponse>();

        Assert.NotNull(dto);
        Assert.Empty(dto!.SportRecords);
        Assert.Equal(0, dto.BestDayPoints);
        Assert.Equal(0, dto.LongestStreakEver);
    }

    [Fact]
    public async Task GetPersonalRecords_AfterLoggingRunningActivity_ReturnsRunningRecord()
    {
        var userId = await CreateUserAsync("Records", "WithRun");
        await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = DateTime.UtcNow.ToString("o"),
            sport = "running",
            distance = 7.5m,
        });

        var response = await _client.GetAsync($"/api/users/{userId}/personal-records");
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<PersonalRecordsResponse>();

        Assert.NotNull(dto);
        var running = dto!.SportRecords.Single(r => r.Sport == "running");
        Assert.Equal(7.5m, running.BestDistance);
    }

    private record PersonalRecordsResponse(
        List<SportRecordResponse> SportRecords,
        int BestDayPoints,
        DateTime? BestDayDate,
        int LongestStreakEver);

    private record SportRecordResponse(string Sport, decimal? BestDistance, string? BestDuration, int? BestSteps, DateTime AchievedAt);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && dotnet test --filter PersonalRecordsControllerTests`
Expected: FAIL — 404 Not Found (route doesn't exist yet).

- [ ] **Step 3: Implement the controller**

Create `backend/Sport4You.Api/Controllers/PersonalRecordsController.cs`, following the exact routing pattern of `backend/Sport4You.Api/Controllers/AchievementsController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class PersonalRecordsController : ControllerBase
{
    private readonly IPersonalRecordsService _records;

    public PersonalRecordsController(IPersonalRecordsService records)
    {
        _records = records;
    }

    [HttpGet("personal-records")]
    public async Task<IActionResult> GetPersonalRecords(Guid userId)
    {
        var result = await _records.GetRecordsAsync(userId);
        return Ok(result);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter PersonalRecordsControllerTests`
Expected: PASS — 2/2 tests passing.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && dotnet test`
Expected: PASS — all tests green (no regressions from Tasks 1-3).

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Controllers/PersonalRecordsController.cs backend/Sport4You.Tests/PersonalRecordsControllerTests.cs
git commit -m "feat: add GET /api/users/{userId}/personal-records endpoint"
```

---

### Task 4: Frontend — models and API service method

**Files:**
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`

**Interfaces:**
- Consumes: nothing new — plain HTTP GET.
- Produces: `SportRecord` and `PersonalRecords` TypeScript interfaces, `ApiService.getPersonalRecords(userId: string): Observable<PersonalRecords>`. Consumed by Task 5's component.

- [ ] **Step 1: Add TypeScript interfaces**

Edit `frontend/src/app/shared/models/dashboard.model.ts` — add at the end of the file (after the `AddStepsResponse` interface):

```ts
export interface SportRecord {
  sport: string;
  bestDistance: number | null;
  bestDuration: string | null;
  bestSteps: number | null;
  achievedAt: string;
}

export interface PersonalRecords {
  sportRecords: SportRecord[];
  bestDayPoints: number;
  bestDayDate: string | null;
  longestStreakEver: number;
}
```

- [ ] **Step 2: Add the API method**

Edit `frontend/src/app/shared/services/api.service.ts` — add this import to the existing import from `'../models/dashboard.model'` (line 6-9):

```ts
import {
  AddStepsResponse, AchievementsPage, AvatarStatus, DashboardData,
  LogActivityRequest, LogActivityResponse, PersonalRecords,
} from '../models/dashboard.model';
```

Then add this method at the end of the `ApiService` class, after `prestige()`:

```ts
  getPersonalRecords(userId: string): Observable<PersonalRecords> {
    return this.http.get<PersonalRecords>(`${this.base}/users/${userId}/personal-records`);
  }
```

- [ ] **Step 3: Verify the frontend still compiles**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: No new errors (there's no automated test for a model/service-only change — a type-check is the correct verification here, live-app verification happens in Task 5 once there's a UI to look at).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/models/dashboard.model.ts frontend/src/app/shared/services/api.service.ts
git commit -m "feat: add PersonalRecords model and ApiService method"
```

---

### Task 5: Frontend — `PersonalRecordsComponent` and profile page integration

**Files:**
- Create: `frontend/src/app/profile/personal-records/personal-records.component.ts`
- Modify: `frontend/src/app/profile/profile.component.ts`

**Interfaces:**
- Consumes: `ApiService.getPersonalRecords(userId)` (Task 4), `SPORT_ICON_NAMES` from `frontend/src/app/shared/constants/sport.constants.ts:10-17` (existing), `SportRecord`/`PersonalRecords` types (Task 4).
- Produces: `<app-personal-records [userId]="userId">` standalone component, self-contained (fetches its own data).

- [ ] **Step 1: Create the component**

Create `frontend/src/app/profile/personal-records/personal-records.component.ts`:

```ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { PersonalRecords, SportRecord } from '../../shared/models/dashboard.model';

const SPORT_LABELS: Record<string, string> = {
  running: 'Running',
  walking: 'Walking',
  cycling: 'Cycling',
  swimming: 'Swimming',
  gym: 'Gym',
  daily_steps: 'Daily Steps',
};

@Component({
  selector: 'app-personal-records',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .empty-state { font-size: 13px; color: #b0bcd4; }
    .records-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .record-card {
      background: #F4F6FB; border-radius: 14px; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .record-card.standout { background: linear-gradient(135deg, #2E6BE6, #1a4fc4); }
    .record-label {
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: .1em; color: #8592ad; text-transform: uppercase;
    }
    .record-card.standout .record-label { color: rgba(255,255,255,.75); }
    .record-value { font-family: 'Chakra Petch', sans-serif; font-size: 20px; font-weight: 700; color: #10203E; }
    .record-card.standout .record-value { color: #fff; }
    .record-date { font-size: 11px; color: #9aa6bd; }
    .record-card.standout .record-date { color: rgba(255,255,255,.65); }
  `],
  template: `
    @if (loading) {
      <div class="empty-state">Loading…</div>
    } @else if (isEmpty) {
      <div class="empty-state">Log your first activity to start setting records.</div>
    } @else {
      <div class="records-grid">
        @for (r of records!.sportRecords; track r.sport) {
          <div class="record-card">
            <span class="record-label">{{ sportLabel(r.sport) }}</span>
            <span class="record-value">{{ formatValue(r) }}</span>
            <span class="record-date">{{ r.achievedAt | date:'MMM d, y' }}</span>
          </div>
        }
        @if (records!.bestDayDate) {
          <div class="record-card standout">
            <span class="record-label">Biggest Day</span>
            <span class="record-value">{{ records!.bestDayPoints | number }} pts</span>
            <span class="record-date">{{ records!.bestDayDate | date:'MMM d, y' }}</span>
          </div>
        }
        @if (records!.longestStreakEver > 0) {
          <div class="record-card standout">
            <span class="record-label">Longest Streak</span>
            <span class="record-value">{{ records!.longestStreakEver }}d</span>
          </div>
        }
      </div>
    }
  `,
})
export class PersonalRecordsComponent implements OnInit {
  @Input() userId = '';

  records: PersonalRecords | null = null;
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getPersonalRecords(this.userId).subscribe({
      next: r => { this.records = r; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get isEmpty(): boolean {
    return !this.records
      || (this.records.sportRecords.length === 0
        && !this.records.bestDayDate
        && this.records.longestStreakEver === 0);
  }

  sportLabel(sport: string): string {
    return SPORT_LABELS[sport] ?? sport;
  }

  formatValue(r: SportRecord): string {
    if (r.bestDistance != null) return `${r.bestDistance} km`;
    if (r.bestDuration != null) return r.bestDuration;
    if (r.bestSteps != null) return `${r.bestSteps.toLocaleString()} steps`;
    return '—';
  }
}
```

The cards are text-only (sport name + value + date), matching the ACHIEVEMENTS section's simplicity — no sport icons in this version.

- [ ] **Step 2: Wire it into the profile page**

Edit `frontend/src/app/profile/profile.component.ts`:

Add the import (after the `ContributionHeatmapComponent` import on line 11):

```ts
import { PersonalRecordsComponent } from './personal-records/personal-records.component';
```

Add `PersonalRecordsComponent` to the `imports` array in the `@Component` decorator (line 16):

```ts
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatSnackBarModule, AvatarLockerComponent, ContributionHeatmapComponent, PersonalRecordsComponent],
```

Add a new "RECORDS" section in the template, after the ACHIEVEMENTS `.section` block (after the closing `</div>` at line 192, before the `@if (!isOwnProfile && earnedAvatars.length > 0) {` block at line 194):

```html
          @if (isOwnProfile) {
            <div class="section">
              <div class="section-title">RECORDS</div>
              <app-personal-records [userId]="userId"></app-personal-records>
            </div>
          }
```

- [ ] **Step 3: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: No errors.

- [ ] **Step 4: Live verification via Playwright**

Start both servers if not already running:

```bash
cd backend/Sport4You.Api && dotnet run &
cd frontend && ng serve &
```

Use Playwright MCP (or the project's established Playwright verification approach) to:
1. Register a new user via the UI or `POST /api/users`.
2. Log at least: two `running` activities on different days (different distances), one `swimming` activity, and enough consecutive-day activities to produce a streak.
3. Log two activities on the same calendar day to produce a multi-activity "biggest day".
4. Navigate to `/profile/{userId}` (as that same user, so `isOwnProfile` is true — `userId` must be in `localStorage`).
5. Confirm the RECORDS section renders: correct per-sport best values, correct biggest-day points total, correct longest streak.
6. Screenshot the section as evidence.
7. Register a second user, view the first user's profile as the second user, and confirm the RECORDS section does NOT render (visibility gate working).

- [ ] **Step 5: Update the feature backlog**

Edit `docs/FEATURE_IDEAS.md` — change:

```
- [ ] Personal records page — **up next**
```

to:

```
- [x] Personal records page — shipped 2026-07-06
```

(and move it from the "Status" checklist section down to alongside the other shipped items, matching how "Rivals", "Contribution heatmap", and "Prestige" are already marked `- [x] ... — shipped 2026-07-05` in that file.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/profile/personal-records/personal-records.component.ts frontend/src/app/profile/profile.component.ts docs/FEATURE_IDEAS.md
git commit -m "feat: add Personal Records section to profile page"
```

---

## Post-Plan Verification

After all tasks are complete, run the full backend suite once more to confirm no cross-task regressions:

```bash
cd backend && dotnet test
```

Expected: all tests passing, including the 11 new tests added across Tasks 1-3 (4 in `ActivityStreakHelperTests`, 5 in `PersonalRecordsServiceTests`, 2 in `PersonalRecordsControllerTests`).
