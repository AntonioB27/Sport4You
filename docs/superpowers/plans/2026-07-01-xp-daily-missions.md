# XP Engine & Daily Missions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an XP progression system (10 levels, exponential curve) and rotating daily missions (30-mission pool, 1 Easy + 1 Medium + 1 Hard per day) that award XP on top of the existing leaderboard points.

**Architecture:** New `IXpService` handles all XP logic (pure calculation + DB operations). Activity logging calls XpService after saving the activity. Dashboard endpoint gains two new fields (`xp`, `dailyMissions`). Frontend binds live data in place of hardcoded values.

**Tech Stack:** C# / ASP.NET Core / EF Core / SQLite (backend) · Angular 17 standalone components / RxJS (frontend)

## Global Constraints

- XP is a separate currency from leaderboard `Points` — never mix them
- `EnsureCreated()` is used (no migrations) — delete `backend/sport4you.db` before first run with new schema
- `ActivityResult` is a `record` — extend by adding new properties to the declaration, update all factory methods
- All DateTime values stored as UTC
- Duration stored as `"MM:SS"` string — parse as `int.Parse(parts[0])` for minutes
- `total_min` requirement type only counts activities with a non-null `Duration` field (swimming + gym)
- Medium mission #8 changed from spec's "Run for 20+ minutes" (running has no duration) to "Run at least 5 km"
- Deterministic mission selection uses a stable FNV-1a hash of `userId + date` — NOT `string.GetHashCode()` (randomised per runtime)
- Never run `git add` or `git commit` — user handles all git operations

---

## File Map

**New backend files:**
- `backend/Sport4You.Api/Models/UserXp.cs`
- `backend/Sport4You.Api/Models/DailyMission.cs`
- `backend/Sport4You.Api/Models/UserMissionCompletion.cs`
- `backend/Sport4You.Api/Models/XpTransaction.cs`
- `backend/Sport4You.Api/Services/IXpService.cs`
- `backend/Sport4You.Api/Services/XpService.cs`
- `backend/Sport4You.Tests/XpServiceTests.cs`

**Modified backend files:**
- `backend/Sport4You.Api/Data/AppDbContext.cs` — add 4 new DbSets + model config
- `backend/Sport4You.Api/Data/DataSeeder.cs` — seed 30 DailyMission rows
- `backend/Sport4You.Api/DTOs/DashboardDto.cs` — add XpDto + DailyMissionDto
- `backend/Sport4You.Api/Services/IActivityService.cs` — extend ActivityResult record
- `backend/Sport4You.Api/Services/ActivityService.cs` — inject IXpService, call after save
- `backend/Sport4You.Api/Services/DashboardService.cs` — inject IXpService, add XP + missions
- `backend/Sport4You.Api/Controllers/ActivitiesController.cs` — return xpEarned + missionsCompleted
- `backend/Sport4You.Api/Program.cs` — register IXpService → XpService
- `backend/Sport4You.Tests/ActivitiesControllerTests.cs` — add XP field assertions

**New frontend files:**
- `frontend/src/app/shared/services/user-state.service.ts`

**Modified frontend files:**
- `frontend/src/app/shared/models/dashboard.model.ts` — add XpInfo, DailyMissionItem, CompletedMission, LogActivityResponse
- `frontend/src/app/shared/services/api.service.ts` — update logActivity return type
- `frontend/src/app/app.component.ts` — live sidebar XP widget
- `frontend/src/app/dashboard/dashboard.component.ts` — live XP bar, live quests, publish to UserStateService
- `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` — +XP in confirmation, mission toasts

---

## Task 1: Database Models + Seed Data

**Files:**
- Create: `backend/Sport4You.Api/Models/UserXp.cs`
- Create: `backend/Sport4You.Api/Models/DailyMission.cs`
- Create: `backend/Sport4You.Api/Models/UserMissionCompletion.cs`
- Create: `backend/Sport4You.Api/Models/XpTransaction.cs`
- Modify: `backend/Sport4You.Api/Data/AppDbContext.cs`
- Modify: `backend/Sport4You.Api/Data/DataSeeder.cs`

**Interfaces:**
- Produces: 4 model classes used by Tasks 2–5; `DataSeeder` that seeds 30 missions; `AppDbContext` with 4 new `DbSet<T>` properties

- [ ] **Step 1: Create the four model classes**

`Models/UserXp.cs`:
```csharp
namespace Sport4You.Api.Models;

public class UserXp
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int TotalXp { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

`Models/DailyMission.cs`:
```csharp
namespace Sport4You.Api.Models;

public class DailyMission
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = string.Empty;          // "easy" | "medium" | "hard"
    public string Description { get; set; } = string.Empty;
    public string RequirementType { get; set; } = string.Empty; // see Global Constraints
    public double RequirementValue { get; set; }
    public string? Sport { get; set; }                         // null = any sport
    public int XpReward { get; set; }                          // 75 | 150 | 300
}
```

`Models/UserMissionCompletion.cs`:
```csharp
namespace Sport4You.Api.Models;

public class UserMissionCompletion
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid MissionId { get; set; }
    public DailyMission Mission { get; set; } = null!;
    public string Date { get; set; } = string.Empty;  // "yyyy-MM-dd"
    public DateTime CompletedAt { get; set; }
}
```

`Models/XpTransaction.cs`:
```csharp
namespace Sport4You.Api.Models;

public class XpTransaction
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Source { get; set; } = string.Empty;  // "activity" | "mission" | "mission_sweep"
    public Guid? SourceId { get; set; }
    public int XpEarned { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

- [ ] **Step 2: Update AppDbContext**

Replace the entire `AppDbContext.cs` content:
```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Models;

namespace Sport4You.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<UserXp> UserXp => Set<UserXp>();
    public DbSet<DailyMission> DailyMissions => Set<DailyMission>();
    public DbSet<UserMissionCompletion> UserMissionCompletions => Set<UserMissionCompletion>();
    public DbSet<XpTransaction> XpTransactions => Set<XpTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.FirstName, u.LastName })
            .IsUnique();

        modelBuilder.Entity<UserXp>()
            .HasKey(u => u.UserId);

        modelBuilder.Entity<UserMissionCompletion>()
            .HasIndex(c => new { c.UserId, c.MissionId, c.Date })
            .IsUnique();
    }
}
```

- [ ] **Step 3: Update DataSeeder to seed 30 daily missions**

Replace `DataSeeder.cs` entirely:
```csharp
using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db, IScoringService scoring)
    {
        SeedUsers(db, scoring);
        SeedMissions(db);
    }

    private static void SeedUsers(AppDbContext db, IScoringService scoring)
    {
        var seedNames = new[] { "Maria Gonzalez", "James Chen", "Sophie Müller", "Luca Rossi", "Amara Osei" };
        if (db.Users.Any(u => seedNames.Contains(u.FirstName + " " + u.LastName))) return;

        var now = DateTime.UtcNow;

        var users = new[]
        {
            new User { Id = Guid.NewGuid(), FirstName = "Maria",   LastName = "Gonzalez" },
            new User { Id = Guid.NewGuid(), FirstName = "James",   LastName = "Chen"     },
            new User { Id = Guid.NewGuid(), FirstName = "Sophie",  LastName = "Müller"   },
            new User { Id = Guid.NewGuid(), FirstName = "Luca",    LastName = "Rossi"    },
            new User { Id = Guid.NewGuid(), FirstName = "Amara",   LastName = "Osei"     },
        };

        db.Users.AddRange(users);

        var activities = new List<(Guid UserId, int DaysAgo, string Sport, decimal? Distance, string? Duration, int? Steps)>
        {
            (users[0].Id,  0, "running",     10.5m,  null,    null),
            (users[0].Id,  1, "running",      8.0m,  null,    null),
            (users[0].Id,  2, "daily_steps",  null,   null,  12000),
            (users[0].Id,  3, "cycling",     25.0m,  null,    null),
            (users[0].Id,  4, "running",      5.0m,  null,    null),
            (users[0].Id,  5, "running",      6.5m,  null,    null),
            (users[0].Id,  8, "cycling",     30.0m,  null,    null),
            (users[0].Id, 10, "running",     12.0m,  null,    null),
            (users[0].Id, 12, "daily_steps",  null,   null,  15000),
            (users[0].Id, 14, "running",      9.0m,  null,    null),
            (users[1].Id,  0, "gym",         null,  "60:00",  null),
            (users[1].Id,  1, "swimming",    null,  "45:00",  null),
            (users[1].Id,  2, "gym",         null,  "75:00",  null),
            (users[1].Id,  3, "gym",         null,  "60:00",  null),
            (users[1].Id,  5, "swimming",    null,  "30:00",  null),
            (users[1].Id,  6, "gym",         null,  "90:00",  null),
            (users[1].Id,  9, "gym",         null,  "60:00",  null),
            (users[1].Id, 11, "swimming",    null,  "45:00",  null),
            (users[1].Id, 13, "gym",         null,  "75:00",  null),
            (users[2].Id,  0, "walking",      5.0m,  null,    null),
            (users[2].Id,  1, "gym",          null, "45:00",  null),
            (users[2].Id,  2, "running",      4.0m,  null,    null),
            (users[2].Id,  3, "daily_steps",  null,   null,  10000),
            (users[2].Id,  5, "cycling",     15.0m,  null,    null),
            (users[2].Id,  7, "swimming",     null, "30:00",  null),
            (users[2].Id,  9, "walking",      6.0m,  null,    null),
            (users[2].Id, 11, "running",      5.0m,  null,    null),
            (users[3].Id,  0, "cycling",     40.0m,  null,    null),
            (users[3].Id,  2, "walking",      8.0m,  null,    null),
            (users[3].Id,  3, "cycling",     35.0m,  null,    null),
            (users[3].Id,  5, "cycling",     50.0m,  null,    null),
            (users[3].Id,  7, "walking",     10.0m,  null,    null),
            (users[3].Id, 10, "cycling",     20.0m,  null,    null),
            (users[3].Id, 14, "cycling",     45.0m,  null,    null),
            (users[4].Id,  0, "daily_steps",  null,  null,   9000),
            (users[4].Id,  1, "daily_steps",  null,  null,  11000),
            (users[4].Id,  2, "running",      3.0m,  null,    null),
            (users[4].Id,  3, "daily_steps",  null,  null,   8500),
            (users[4].Id,  4, "walking",      4.0m,  null,    null),
            (users[4].Id,  6, "daily_steps",  null,  null,  13000),
            (users[4].Id,  8, "running",      4.0m,  null,    null),
        };

        foreach (var (userId, daysAgo, sport, distance, duration, steps) in activities)
        {
            var points = scoring.CalculatePoints(sport, distance, duration, steps);
            db.Activities.Add(new Activity
            {
                Id       = Guid.NewGuid(),
                UserId   = userId,
                DateTime = now.AddDays(-daysAgo).AddHours(-Random.Shared.Next(0, 8)),
                Sport    = sport,
                Distance = distance,
                Duration = duration,
                Steps    = steps,
                Points   = points,
            });
        }

        db.SaveChanges();
    }

    private static void SeedMissions(AppDbContext db)
    {
        if (db.DailyMissions.Any()) return;

        db.DailyMissions.AddRange(
            // Easy — 75 XP each
            M("easy", "Log any activity today",                       "activity_count",  1,   null,        75),
            M("easy", "Walk at least 2 km",                          "distance_km",     2,   "walking",   75),
            M("easy", "Do 15+ minutes of gym or swimming",           "total_min",       15,  null,        75),
            M("easy", "Hit 3,000 steps",                             "steps",           3000, null,       75),
            M("easy", "Log a gym session",                           "activity_count",  1,   "gym",       75),
            M("easy", "Go for any cycle ride",                       "activity_count",  1,   "cycling",   75),
            M("easy", "Do any swimming today",                       "activity_count",  1,   "swimming",  75),
            M("easy", "Log 2 activities today",                      "activity_count",  2,   null,        75),
            M("easy", "Run at least 1 km",                          "distance_km",     1,   "running",   75),
            M("easy", "Spend 20+ minutes swimming or at the gym",   "total_min",       20,  null,        75),

            // Medium — 150 XP each
            M("medium", "Run at least 3 km",                        "distance_km",     3,   "running",   150),
            M("medium", "Hit 5,000 steps",                          "steps",           5000, null,       150),
            M("medium", "Cycle at least 10 km",                     "distance_km",     10,  "cycling",   150),
            M("medium", "Swim for 20+ minutes",                     "duration_min",    20,  "swimming",  150),
            M("medium", "Spend 30+ minutes at the gym",             "duration_min",    30,  "gym",       150),
            M("medium", "Walk 5 km",                                "distance_km",     5,   "walking",   150),
            M("medium", "Log activities in 2 different sports",     "sport_count",     2,   null,        150),
            M("medium", "Run at least 5 km",                        "distance_km",     5,   "running",   150),
            M("medium", "Cycle 15 km",                              "distance_km",     15,  "cycling",   150),
            M("medium", "Spend 45+ minutes swimming or at the gym", "total_min",       45,  null,        150),

            // Hard — 300 XP each
            M("hard", "Run 10 km or more",                          "distance_km",     10,  "running",   300),
            M("hard", "Cycle 25 km or more",                        "distance_km",     25,  "cycling",   300),
            M("hard", "Hit 10,000 steps",                           "steps",           10000, null,      300),
            M("hard", "Swim for 45+ minutes",                       "duration_min",    45,  "swimming",  300),
            M("hard", "Spend 60+ minutes at the gym",               "duration_min",    60,  "gym",       300),
            M("hard", "Walk 10 km",                                 "distance_km",     10,  "walking",   300),
            M("hard", "Log 3 activities in 3 different sports",     "sport_count",     3,   null,        300),
            M("hard", "Run 7 km or more",                           "distance_km",     7,   "running",   300),
            M("hard", "Spend 90+ minutes swimming or at the gym",   "total_min",       90,  null,        300),
            M("hard", "Spend 120+ minutes swimming or at the gym",  "total_min",       120, null,        300)
        );

        db.SaveChanges();
    }

    private static DailyMission M(string tier, string desc, string reqType, double reqVal, string? sport, int xp)
        => new() { Id = Guid.NewGuid(), Tier = tier, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp };
}
```

- [ ] **Step 4: Delete the SQLite database and verify the app starts cleanly**

```bash
rm -f backend/sport4you.db
cd backend && dotnet run --project Sport4You.Api
```

Expected: app starts without errors, DB is recreated with the new tables, seed data logs appear (if any).

Press Ctrl+C after confirming startup.

- [ ] **Step 5: Run existing tests to confirm nothing is broken**

```bash
cd backend && dotnet test Sport4You.Tests
```

Expected: all existing tests pass.

---

## Task 2: Pure XpService — Calculation Logic

**Files:**
- Create: `backend/Sport4You.Api/Services/IXpService.cs`
- Create: `backend/Sport4You.Api/Services/XpService.cs` (pure methods only — DB methods added in Task 3)
- Test: `backend/Sport4You.Tests/XpServiceTests.cs`

**Interfaces:**
- Consumes: `AppDbContext` (injected but unused by pure methods in this task)
- Produces:
  - `IXpService.CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps) → int`
  - `IXpService.GetLevelInfo(int totalXp) → LevelInfo`
  - `record LevelInfo(int Level, string Title, int XpInLevel, int XpForNextLevel, int XpPercent)`

- [ ] **Step 1: Write the failing tests**

Create `backend/Sport4You.Tests/XpServiceTests.cs`:
```csharp
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class XpServiceTests
{
    private readonly XpService _svc = new(null!);  // null DbContext — pure methods only

    [Theory]
    [InlineData("running",     5.0,  null,    null,  100)]  // floor(5 * 20)   = 100
    [InlineData("walking",     3.0,  null,    null,   30)]  // floor(3 * 10)   = 30
    [InlineData("cycling",    10.0,  null,    null,   50)]  // floor(10 * 5)   = 50
    [InlineData("swimming",   null, "30:00",  null,   90)]  // floor(30 * 3)   = 90
    [InlineData("gym",        null, "45:00",  null,   90)]  // floor(45 * 2)   = 90
    [InlineData("daily_steps", null,  null,  5000,   10)]  // floor(5000/500) = 10
    [InlineData("running",     2.7,  null,    null,   54)]  // floor(2.7 * 20) = 54 (floor check)
    public void CalculateActivityXp_ReturnsCorrectXp(
        string sport, double? dist, string? dur, int? steps, int expected)
    {
        var result = _svc.CalculateActivityXp(sport, (decimal?)dist, dur, steps);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(0,      1, "ROOKIE",     0,       200, 0)]
    [InlineData(100,    1, "ROOKIE",   100,       200, 50)]
    [InlineData(200,    2, "JOGGER",     0,       400, 0)]
    [InlineData(400,    2, "JOGGER",   200,       400, 50)]
    [InlineData(600,    3, "RUNNER",     0,       800, 0)]
    [InlineData(1400,   4, "ATHLETE",    0,      1600, 0)]
    [InlineData(3000,   5, "COMPETITOR", 0,      3000, 0)]
    [InlineData(6000,   6, "ELITE",      0,      5000, 0)]
    [InlineData(11000,  7, "CHAMPION",   0,      9000, 0)]
    [InlineData(20000,  8, "MASTER",     0,     15000, 0)]
    [InlineData(35000,  9, "LEGEND",     0,     25000, 0)]
    [InlineData(60000, 10, "IMMORTAL", 60000, int.MaxValue, 100)]
    public void GetLevelInfo_ReturnsCorrectLevel(
        int totalXp, int expLevel, string expTitle,
        int expXpInLevel, int expXpForNext, int expPercent)
    {
        var info = _svc.GetLevelInfo(totalXp);
        Assert.Equal(expLevel, info.Level);
        Assert.Equal(expTitle, info.Title);
        Assert.Equal(expXpInLevel, info.XpInLevel);
        Assert.Equal(expXpForNext, info.XpForNextLevel);
        Assert.Equal(expPercent, info.XpPercent);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && dotnet test Sport4You.Tests --filter "XpServiceTests" -v
```

Expected: FAIL with compilation error (XpService does not exist yet).

- [ ] **Step 3: Create IXpService with pure method signatures**

`Services/IXpService.cs`:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record LevelInfo(int Level, string Title, int XpInLevel, int XpForNextLevel, int XpPercent);
public record XpSummary(int TotalXp, LevelInfo LevelInfo);
public record MissionEvaluationResult(List<CompletedMissionDto> NewlyCompleted, int XpAwarded);
public record DailyMissionStatus(
    Guid Id, string Tier, string Description, int XpReward,
    bool Completed, double Progress, double ProgressMax);

public interface IXpService
{
    // Pure (no DB) — fully unit testable
    int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps);
    LevelInfo GetLevelInfo(int totalXp);

    // DB operations — added in Task 3
    Task<int> AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps);
    Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date);
    Task<XpSummary> GetXpSummaryAsync(Guid userId);
    Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date);
}
```

- [ ] **Step 4: Create XpService with pure methods**

`Services/XpService.cs`:
```csharp
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Sport4You.Api.Services;

public class XpService : IXpService
{
    private readonly AppDbContext _db;
    public XpService(AppDbContext db) => _db = db;

    // ── Level thresholds ──────────────────────────────────────────────────────
    private static readonly (int Threshold, string Title)[] Levels =
    [
        (     0, "ROOKIE"),
        (   200, "JOGGER"),
        (   600, "RUNNER"),
        (  1400, "ATHLETE"),
        (  3000, "COMPETITOR"),
        (  6000, "ELITE"),
        ( 11000, "CHAMPION"),
        ( 20000, "MASTER"),
        ( 35000, "LEGEND"),
        ( 60000, "IMMORTAL"),
    ];

    // ── Pure: XP formula ─────────────────────────────────────────────────────
    public int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps)
        => sport.ToLower() switch
        {
            "running"     => (int)(distance!.Value * 20),
            "walking"     => (int)(distance!.Value * 10),
            "cycling"     => (int)(distance!.Value * 5),
            "swimming"    => ParseMinutes(duration!) * 3,
            "gym"         => ParseMinutes(duration!) * 2,
            "daily_steps" => (steps!.Value / 500),
            _             => 0,
        };

    // ── Pure: level lookup ────────────────────────────────────────────────────
    public LevelInfo GetLevelInfo(int totalXp)
    {
        var level = 1;
        for (var i = Levels.Length - 1; i >= 0; i--)
        {
            if (totalXp >= Levels[i].Threshold) { level = i + 1; break; }
        }

        var title = Levels[level - 1].Title;
        var levelStart = Levels[level - 1].Threshold;

        if (level == Levels.Length)
            return new LevelInfo(level, title, totalXp, int.MaxValue, 100);

        var levelEnd = Levels[level].Threshold;
        var xpInLevel = totalXp - levelStart;
        var xpForNextLevel = levelEnd - levelStart;
        var xpPercent = (int)((double)xpInLevel / xpForNextLevel * 100);

        return new LevelInfo(level, title, xpInLevel, xpForNextLevel, xpPercent);
    }

    // ── DB methods: stubbed here, implemented in Task 3 ──────────────────────
    public Task<int> AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps)
        => throw new NotImplementedException();

    public Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date)
        => throw new NotImplementedException();

    public Task<XpSummary> GetXpSummaryAsync(Guid userId)
        => throw new NotImplementedException();

    public Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date)
        => throw new NotImplementedException();

    // ── Helpers ───────────────────────────────────────────────────────────────
    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && dotnet test Sport4You.Tests --filter "XpServiceTests" -v
```

Expected: all 19 test cases pass.

---

## Task 3: XpService DB Methods

**Files:**
- Modify: `backend/Sport4You.Api/Services/XpService.cs` — replace the 4 `NotImplementedException` stubs
- Modify: `backend/Sport4You.Api/Program.cs` — register `IXpService`
- Test: `backend/Sport4You.Tests/XpServiceTests.cs` — add integration tests using TestFactory

**Interfaces:**
- Consumes: `AppDbContext`, `DailyMission`, `UserXp`, `UserMissionCompletion`, `XpTransaction` models from Task 1; `IXpService`/`LevelInfo`/`XpSummary`/`MissionEvaluationResult`/`DailyMissionStatus` from Task 2
- Produces:
  - `AwardActivityXpAsync` → awards XP from an activity, writes `XpTransaction`, returns `xpEarned`
  - `EvaluateDailyMissionsAsync` → evaluates today's missions, awards XP for newly completed ones
  - `GetXpSummaryAsync` → reads `UserXp` row and returns `XpSummary`
  - `GetDailyMissionStatusAsync` → returns today's 3 missions with progress

- [ ] **Step 1: Write the failing integration tests**

Add to `backend/Sport4You.Tests/XpServiceTests.cs`:
```csharp
// Note: These tests run against the full DI stack using TestFactory.
// Add after the unit test class, or add them as a separate region within the same class.

public class XpServiceIntegrationTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public XpServiceIntegrationTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync()
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Xp", lastName = "Tester" });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogActivity_ReturnsXpEarned()
    {
        var userId = await CreateUserAsync();
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-07-01T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        var xp = ((System.Text.Json.JsonElement)body!["xpEarned"]).GetInt32();
        Assert.Equal(100, xp);  // floor(5 * 20) = 100
    }

    [Fact]
    public async Task LogActivity_ReturnsMissionsCompletedArray()
    {
        var userId = await CreateUserAsync();
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-07-01T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var missions = body.GetProperty("missionsCompleted");
        Assert.Equal(System.Text.Json.JsonValueKind.Array, missions.ValueKind);
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && dotnet test Sport4You.Tests --filter "XpServiceIntegrationTests" -v
```

Expected: FAIL — `xpEarned` not in response yet (Task 4 wires it up); but the test will compile. The `LogActivity_ReturnsXpEarned` test fails because the field doesn't exist in the response yet. That is expected — these tests drive Tasks 3 and 4 together.

- [ ] **Step 3: Implement the 4 DB methods in XpService**

Replace the entire `XpService.cs` file (keep pure methods, replace the 4 stubs):
```csharp
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Sport4You.Api.Services;

public class XpService : IXpService
{
    private readonly AppDbContext _db;
    public XpService(AppDbContext db) => _db = db;

    private static readonly (int Threshold, string Title)[] Levels =
    [
        (     0, "ROOKIE"),
        (   200, "JOGGER"),
        (   600, "RUNNER"),
        (  1400, "ATHLETE"),
        (  3000, "COMPETITOR"),
        (  6000, "ELITE"),
        ( 11000, "CHAMPION"),
        ( 20000, "MASTER"),
        ( 35000, "LEGEND"),
        ( 60000, "IMMORTAL"),
    ];

    public int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps)
        => sport.ToLower() switch
        {
            "running"     => (int)(distance!.Value * 20),
            "walking"     => (int)(distance!.Value * 10),
            "cycling"     => (int)(distance!.Value * 5),
            "swimming"    => ParseMinutes(duration!) * 3,
            "gym"         => ParseMinutes(duration!) * 2,
            "daily_steps" => (steps!.Value / 500),
            _             => 0,
        };

    public LevelInfo GetLevelInfo(int totalXp)
    {
        var level = 1;
        for (var i = Levels.Length - 1; i >= 0; i--)
        {
            if (totalXp >= Levels[i].Threshold) { level = i + 1; break; }
        }

        var title = Levels[level - 1].Title;
        var levelStart = Levels[level - 1].Threshold;

        if (level == Levels.Length)
            return new LevelInfo(level, title, totalXp, int.MaxValue, 100);

        var levelEnd = Levels[level].Threshold;
        var xpInLevel = totalXp - levelStart;
        var xpForNextLevel = levelEnd - levelStart;
        var xpPercent = (int)((double)xpInLevel / xpForNextLevel * 100);

        return new LevelInfo(level, title, xpInLevel, xpForNextLevel, xpPercent);
    }

    public async Task<int> AwardActivityXpAsync(
        Guid userId, Guid activityId, string sport,
        decimal? distance, string? duration, int? steps)
    {
        var xpEarned = CalculateActivityXp(sport, distance, duration, steps);
        var now = DateTime.UtcNow;

        var row = await _db.UserXp.FindAsync(userId);
        if (row == null)
        {
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xpEarned, UpdatedAt = now });
        }
        else
        {
            row.TotalXp += xpEarned;
            row.UpdatedAt = now;
        }

        _db.XpTransactions.Add(new XpTransaction
        {
            Id = Guid.NewGuid(), UserId = userId, Source = "activity",
            SourceId = activityId, XpEarned = xpEarned, CreatedAt = now,
        });

        await _db.SaveChangesAsync();
        return xpEarned;
    }

    public async Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date)
    {
        var dateStr = date.ToString("yyyy-MM-dd");
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);
        var now = DateTime.UtcNow;

        var todayActivities = await _db.Activities
            .Where(a => a.UserId == userId && a.DateTime >= dayStart && a.DateTime < dayEnd)
            .ToListAsync();

        var agg = ComputeAggregates(todayActivities);

        var allMissions = await _db.DailyMissions.ToListAsync();
        var (easy, medium, hard) = SelectDailyMissions(userId, date, allMissions);
        var todayMissions = new[] { easy, medium, hard };

        var alreadyCompleted = await _db.UserMissionCompletions
            .Where(c => c.UserId == userId && c.Date == dateStr)
            .Select(c => c.MissionId)
            .ToListAsync();

        var newlyCompleted = new List<CompletedMissionDto>();
        var xpAwarded = 0;

        foreach (var mission in todayMissions)
        {
            if (alreadyCompleted.Contains(mission.Id)) continue;
            if (!EvaluateMission(mission, agg)) continue;

            _db.UserMissionCompletions.Add(new UserMissionCompletion
            {
                Id = Guid.NewGuid(), UserId = userId,
                MissionId = mission.Id, Date = dateStr, CompletedAt = now,
            });

            _db.XpTransactions.Add(new XpTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Source = "mission",
                SourceId = mission.Id, XpEarned = mission.XpReward, CreatedAt = now,
            });

            xpAwarded += mission.XpReward;
            newlyCompleted.Add(new CompletedMissionDto(mission.Description, mission.XpReward));
        }

        // Sweep bonus if all 3 now complete
        var totalCompleted = alreadyCompleted.Count + newlyCompleted.Count;
        if (totalCompleted >= 3)
        {
            var sweepAlreadyAwarded = await _db.XpTransactions.AnyAsync(
                t => t.UserId == userId && t.Source == "mission_sweep"
                     && t.CreatedAt >= dayStart && t.CreatedAt < dayEnd);

            if (!sweepAlreadyAwarded)
            {
                _db.XpTransactions.Add(new XpTransaction
                {
                    Id = Guid.NewGuid(), UserId = userId, Source = "mission_sweep",
                    SourceId = null, XpEarned = 100, CreatedAt = now,
                });
                xpAwarded += 100;
            }
        }

        if (xpAwarded > 0)
        {
            var row = await _db.UserXp.FindAsync(userId);
            if (row == null)
            {
                _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xpAwarded, UpdatedAt = now });
            }
            else
            {
                row.TotalXp += xpAwarded;
                row.UpdatedAt = now;
            }
        }

        await _db.SaveChangesAsync();
        return new MissionEvaluationResult(newlyCompleted, xpAwarded);
    }

    public async Task<XpSummary> GetXpSummaryAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        var totalXp = row?.TotalXp ?? 0;
        return new XpSummary(totalXp, GetLevelInfo(totalXp));
    }

    public async Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date)
    {
        var dateStr = date.ToString("yyyy-MM-dd");
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        var todayActivities = await _db.Activities
            .Where(a => a.UserId == userId && a.DateTime >= dayStart && a.DateTime < dayEnd)
            .ToListAsync();

        var agg = ComputeAggregates(todayActivities);
        var allMissions = await _db.DailyMissions.ToListAsync();
        var (easy, medium, hard) = SelectDailyMissions(userId, date, allMissions);

        var completedIds = await _db.UserMissionCompletions
            .Where(c => c.UserId == userId && c.Date == dateStr)
            .Select(c => c.MissionId)
            .ToListAsync();

        return new[] { easy, medium, hard }
            .Select(m => new DailyMissionStatus(
                m.Id, m.Tier, m.Description, m.XpReward,
                completedIds.Contains(m.Id),
                GetProgress(m, agg),
                m.RequirementValue))
            .ToArray();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private record DailyAggregates(
        int TotalActivityCount,
        Dictionary<string, int> ActivityCountBySport,
        Dictionary<string, decimal> DistanceBySport,
        Dictionary<string, int> DurationMinBySport,
        int TotalSteps,
        int DistinctSportCount,
        int TotalDurationMin);

    private static DailyAggregates ComputeAggregates(IList<Activity> activities)
    {
        var countBySport = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var distBySport  = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var durBySport   = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var totalSteps = 0;
        var totalDurationMin = 0;

        foreach (var a in activities)
        {
            countBySport[a.Sport] = countBySport.GetValueOrDefault(a.Sport) + 1;

            if (a.Distance.HasValue)
                distBySport[a.Sport] = distBySport.GetValueOrDefault(a.Sport) + a.Distance.Value;

            if (a.Duration != null)
            {
                var min = ParseMinutes(a.Duration);
                durBySport[a.Sport] = durBySport.GetValueOrDefault(a.Sport) + min;
                totalDurationMin += min;
            }

            if (a.Steps.HasValue)
                totalSteps += a.Steps.Value;
        }

        return new DailyAggregates(
            activities.Count, countBySport, distBySport,
            durBySport, totalSteps, countBySport.Keys.Count, totalDurationMin);
    }

    private static bool EvaluateMission(DailyMission mission, DailyAggregates agg)
    {
        var req = mission.RequirementValue;
        var sport = mission.Sport?.ToLower();
        return mission.RequirementType switch
        {
            "activity_count" => sport == null
                ? agg.TotalActivityCount >= req
                : agg.ActivityCountBySport.GetValueOrDefault(sport) >= req,
            "distance_km" => sport != null &&
                (double)agg.DistanceBySport.GetValueOrDefault(sport) >= req,
            "duration_min" => sport != null &&
                agg.DurationMinBySport.GetValueOrDefault(sport) >= req,
            "steps"       => agg.TotalSteps >= req,
            "total_min"   => agg.TotalDurationMin >= req,
            "sport_count" => agg.DistinctSportCount >= req,
            _ => false,
        };
    }

    private static double GetProgress(DailyMission mission, DailyAggregates agg)
    {
        var sport = mission.Sport?.ToLower();
        return mission.RequirementType switch
        {
            "activity_count" => sport == null
                ? agg.TotalActivityCount
                : agg.ActivityCountBySport.GetValueOrDefault(sport),
            "distance_km" => sport != null
                ? (double)agg.DistanceBySport.GetValueOrDefault(sport) : 0,
            "duration_min" => sport != null
                ? agg.DurationMinBySport.GetValueOrDefault(sport) : 0,
            "steps"       => agg.TotalSteps,
            "total_min"   => agg.TotalDurationMin,
            "sport_count" => agg.DistinctSportCount,
            _ => 0,
        };
    }

    private static (DailyMission Easy, DailyMission Medium, DailyMission Hard) SelectDailyMissions(
        Guid userId, DateOnly date, IList<DailyMission> allMissions)
    {
        var seed = StableSeed(userId, date);
        var rng = new Random(seed);

        var easyPool   = allMissions.Where(m => m.Tier == "easy").ToList();
        var mediumPool = allMissions.Where(m => m.Tier == "medium").ToList();
        var hardPool   = allMissions.Where(m => m.Tier == "hard").ToList();

        return (easyPool[rng.Next(easyPool.Count)],
                mediumPool[rng.Next(mediumPool.Count)],
                hardPool[rng.Next(hardPool.Count)]);
    }

    private static int StableSeed(Guid userId, DateOnly date)
    {
        // FNV-1a hash — stable across .NET runtime restarts (unlike string.GetHashCode)
        var input = $"{userId:N}{date:yyyy-MM-dd}";
        var hash = 2166136261u;
        foreach (var c in input) { hash ^= c; hash *= 16777619; }
        return (int)(hash & 0x7FFFFFFF);
    }

    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
```

- [ ] **Step 4: Register IXpService in Program.cs**

Open `backend/Sport4You.Api/Program.cs`. After the existing service registrations (where `IScoringService`, `IActivityService`, etc. are registered), add:
```csharp
builder.Services.AddScoped<IXpService, XpService>();
```

- [ ] **Step 5: Run all tests**

```bash
cd backend && dotnet test Sport4You.Tests -v
```

Expected: unit tests pass; integration tests that check `xpEarned` in the response still fail (wired in Task 4) — that is expected.

---

## Task 4: Wire XP into Activity Logging

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs` — add `CompletedMissionDto`
- Modify: `backend/Sport4You.Api/Services/IActivityService.cs` — extend `ActivityResult`
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs` — inject `IXpService`, call after save
- Modify: `backend/Sport4You.Api/Controllers/ActivitiesController.cs` — return xpEarned + missionsCompleted
- Test: `backend/Sport4You.Tests/ActivitiesControllerTests.cs` — assert new fields

**Interfaces:**
- Consumes: `IXpService.AwardActivityXpAsync`, `IXpService.EvaluateDailyMissionsAsync`
- Produces: `POST /api/activities` response extended with `xpEarned: int` and `missionsCompleted: [{description, xpEarned}]`

- [ ] **Step 1: Add CompletedMissionDto to DTOs**

Open `backend/Sport4You.Api/DTOs/DashboardDto.cs`. At the bottom of the file, add:
```csharp
public record CompletedMissionDto(string Description, int XpEarned);
```

- [ ] **Step 2: Extend ActivityResult**

In `backend/Sport4You.Api/Services/IActivityService.cs`, replace the entire file:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points,
    int XpEarned, List<CompletedMissionDto> MissionsCompleted)
{
    public static ActivityResult Success(Guid id, int points, int xpEarned, List<CompletedMissionDto> missions)
        => new(false, false, null, id, points, xpEarned, missions);

    public static ActivityResult BadRequest(string error)
        => new(true, false, error, Guid.Empty, 0, 0, []);

    public static ActivityResult NotFound(string error)
        => new(true, true, error, Guid.Empty, 0, 0, []);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
```

- [ ] **Step 3: Update ActivityService to inject IXpService and call it**

In `backend/Sport4You.Api/Services/ActivityService.cs`, replace the constructor and `LogActivityAsync` method:
```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class ActivityService : IActivityService
{
    private static readonly HashSet<string> DistanceSports = ["running", "walking", "cycling"];
    private static readonly HashSet<string> DurationSports = ["gym", "swimming"];

    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IScoringService _scoring;
    private readonly IXpService _xp;

    public ActivityService(
        IUserRepository users, IActivityRepository activities,
        IScoringService scoring, IXpService xp)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
        _xp = xp;
    }

    public async Task<ActivityResult> LogActivityAsync(LogActivityRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
            return ActivityResult.BadRequest("Invalid userId format");

        var user = await _users.GetByIdAsync(userId);
        if (user == null)
            return ActivityResult.NotFound("User not found");

        if (!DateTime.TryParse(request.Datetime, out var dateTime))
            return ActivityResult.BadRequest("Invalid datetime format");

        var (isValid, error, sport) = ValidateSportMetrics(request);
        if (!isValid)
            return ActivityResult.BadRequest(error!);

        var points = _scoring.CalculatePoints(sport, request.Distance, request.Duration, request.Steps);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DateTime = dateTime,
            Sport = sport,
            Distance = request.Distance,
            Duration = request.Duration,
            Steps = request.Steps,
            Points = points,
        };

        await _activities.CreateAsync(activity);

        var xpEarned = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);

        var missionResult = await _xp.EvaluateDailyMissionsAsync(
            userId, DateOnly.FromDateTime(dateTime.ToUniversalTime()));

        return ActivityResult.Success(activity.Id, points, xpEarned, missionResult.NewlyCompleted);
    }

    // ValidateSportMetrics — unchanged from original, keep as-is
    private static (bool isValid, string? error, string sport) ValidateSportMetrics(LogActivityRequest r)
    {
        var sport = r.Sport?.ToLower();

        if (sport == null && r.Steps == null)
            return (false, "Either sport or steps must be provided", string.Empty);

        if (r.Steps.HasValue && sport == null)
        {
            if (r.Distance.HasValue || r.Duration != null)
                return (false, "Steps activity cannot include distance or duration", string.Empty);
            return (true, null, "daily_steps");
        }

        if (DistanceSports.Contains(sport!))
        {
            if (!r.Distance.HasValue)
                return (false, $"{sport} requires a distance value", string.Empty);
            if (r.Duration != null || r.Steps.HasValue)
                return (false, $"{sport} cannot include duration or steps", string.Empty);
            return (true, null, sport!);
        }

        if (DurationSports.Contains(sport!))
        {
            if (r.Duration == null)
                return (false, $"{sport} requires a duration value", string.Empty);
            if (r.Distance.HasValue || r.Steps.HasValue)
                return (false, $"{sport} cannot include distance or steps", string.Empty);
            return (true, null, sport!);
        }

        return (false, $"Unknown sport: {sport}", string.Empty);
    }
}
```

- [ ] **Step 4: Update ActivitiesController to return new fields**

In `backend/Sport4You.Api/Controllers/ActivitiesController.cs`, replace the `return Ok(...)` line:
```csharp
return Ok(new
{
    activityId = result.ActivityId,
    points = result.Points,
    xpEarned = result.XpEarned,
    missionsCompleted = result.MissionsCompleted,
});
```

- [ ] **Step 5: Run all tests**

```bash
cd backend && dotnet test Sport4You.Tests -v
```

Expected: all existing tests pass; the integration tests written in Task 3 now pass (`xpEarned` field exists and equals 100 for a 5 km run).

---

## Task 5: Dashboard XP + Missions

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs` — add `XpDto`, `DailyMissionDto`
- Modify: `backend/Sport4You.Api/Services/DashboardService.cs` — inject IXpService, call GetXpSummaryAsync + GetDailyMissionStatusAsync

**Interfaces:**
- Consumes: `IXpService.GetXpSummaryAsync`, `IXpService.GetDailyMissionStatusAsync`, `DailyMissionStatus` record from Task 2
- Produces: `GET /api/users/{userId}/dashboard` response includes `xp` and `dailyMissions` fields

- [ ] **Step 1: Add XpDto and DailyMissionDto to DashboardDto.cs**

Open `backend/Sport4You.Api/DTOs/DashboardDto.cs`. The file currently contains the existing DTO classes. Read the file first, then append the following records. Do NOT remove any existing DTOs.

```csharp
public record XpDto(
    int Total, int Level, string LevelTitle,
    int XpInLevel, int XpForNextLevel, int XpPercent);

public record DailyMissionDto(
    Guid Id, string Tier, string Description, int XpReward,
    bool Completed, double Progress, double ProgressMax);
```

Then find the `DashboardDto` class/record and add two new properties:
- `XpDto Xp`
- `DailyMissionDto[] DailyMissions`

If `DashboardDto` is a record, it will look like:
```csharp
public record DashboardDto(
    // ... existing fields ...,
    XpDto Xp,
    DailyMissionDto[] DailyMissions
);
```

If it's a class, add:
```csharp
public XpDto Xp { get; set; } = null!;
public DailyMissionDto[] DailyMissions { get; set; } = [];
```

(Read the actual file to determine which form to use — match the existing pattern.)

- [ ] **Step 2: Update DashboardService to populate XP and missions**

Open `backend/Sport4You.Api/Services/DashboardService.cs`. Add `IXpService` to the constructor and populate the new fields in `GetDashboardAsync`.

The additions go after the existing data is assembled, before returning the DTO:
```csharp
// In constructor — add IXpService parameter:
private readonly IXpService _xp;

// In constructor body — add:
_xp = xp;

// In GetDashboardAsync — add after existing data assembly, before return:
var xpSummary = await _xp.GetXpSummaryAsync(userId);
var missionStatuses = await _xp.GetDailyMissionStatusAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow));

var xpDto = new XpDto(
    xpSummary.TotalXp,
    xpSummary.LevelInfo.Level,
    xpSummary.LevelInfo.Title,
    xpSummary.LevelInfo.XpInLevel,
    xpSummary.LevelInfo.XpForNextLevel,
    xpSummary.LevelInfo.XpPercent);

var missionDtos = missionStatuses.Select(m => new DailyMissionDto(
    m.Id, m.Tier, m.Description, m.XpReward,
    m.Completed, m.Progress, m.ProgressMax)).ToArray();
```

Then include `xpDto` and `missionDtos` in the returned `DashboardDto`.

The DI system needs to inject `IXpService` — add it as a constructor parameter alongside the existing ones.

- [ ] **Step 3: Run all tests**

```bash
cd backend && dotnet test Sport4You.Tests -v
```

Expected: all tests pass. At this point the backend is complete.

- [ ] **Step 4: Manual smoke test**

```bash
# Start backend
cd backend && dotnet run --project Sport4You.Api &

# Register a user
curl -s -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User"}' | jq .

# Copy the userId, then log a 5km run:
curl -s -X POST http://localhost:5000/api/activities \
  -H "Content-Type: application/json" \
  -d '{"userId":"PASTE_ID","datetime":"2026-07-01T10:00:00Z","sport":"running","distance":5.0}' | jq .

# Expected: { "points": 500, "xpEarned": 100, "missionsCompleted": [...] }

# Check dashboard:
curl -s http://localhost:5000/api/users/PASTE_ID/dashboard | jq '.xp, .dailyMissions'
```

Kill the background server when done.

---

## Task 6: Frontend — Types + API Service

**Files:**
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`

**Interfaces:**
- Produces: TypeScript interfaces `XpInfo`, `DailyMissionItem`, `CompletedMission`; updated `LogActivityResponse` type

- [ ] **Step 1: Extend dashboard.model.ts**

Replace the entire `dashboard.model.ts` with:
```typescript
export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
}

export interface XpInfo {
  total: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForNextLevel: number;
  xpPercent: number;
}

export interface DailyMissionItem {
  id: string;
  tier: 'easy' | 'medium' | 'hard';
  description: string;
  xpReward: number;
  completed: boolean;
  progress: number;
  progressMax: number;
}

export interface ActivityItem {
  id: string;
  dateTime: string;
  sport: string;
  distance?: number;
  duration?: string;
  steps?: number;
  points: number;
}

export interface LogActivityRequest {
  userId: string;
  datetime: string;
  sport?: string;
  distance?: number;
  duration?: string;
  steps?: number;
}

export interface CompletedMission {
  description: string;
  xpEarned: number;
}

export interface LogActivityResponse {
  activityId: string;
  points: number;
  xpEarned: number;
  missionsCompleted: CompletedMission[];
}
```

- [ ] **Step 2: Update api.service.ts return type**

In `frontend/src/app/shared/services/api.service.ts`, update the `logActivity` method signature. Change the import at the top to include the new types:
```typescript
import { DashboardData, LogActivityRequest, LogActivityResponse } from '../models/dashboard.model';
```

Then change the `logActivity` method:
```typescript
logActivity(request: LogActivityRequest): Observable<LogActivityResponse> {
  return this.http.post<LogActivityResponse>(`${this.base}/activities`, request);
}
```

- [ ] **Step 3: Build the frontend to confirm no type errors**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: build succeeds with no errors (the new types are additive; existing code continues to work because `xp` and `dailyMissions` will just be `undefined` until wired up).

---

## Task 7: UserStateService + Live Sidebar XP

**Files:**
- Create: `frontend/src/app/shared/services/user-state.service.ts`
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts` (publish only — quest binding is Task 8)

**Interfaces:**
- Consumes: `XpInfo` from Task 6
- Produces: `UserStateService` with `xp$: Observable<XpInfo | null>` and `setXp(xp: XpInfo)`. Sidebar reads from it. Dashboard publishes to it.

- [ ] **Step 1: Create UserStateService**

`frontend/src/app/shared/services/user-state.service.ts`:
```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { XpInfo } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private xpSubject = new BehaviorSubject<XpInfo | null>(null);
  readonly xp$ = this.xpSubject.asObservable();

  setXp(xp: XpInfo): void {
    this.xpSubject.next(xp);
  }
}
```

- [ ] **Step 2: Read app.component.ts to understand the current sidebar XP widget**

Use the Read tool on `frontend/src/app/app.component.ts` to find:
1. The import section (to add `UserStateService` and `AsyncPipe`)
2. The sidebar XP widget template section (hardcoded "550 XP" text)
3. The constructor / DI injection

- [ ] **Step 3: Update AppComponent to subscribe to live XP**

In `app.component.ts`:

Add import:
```typescript
import { UserStateService } from './shared/services/user-state.service';
import { XpInfo } from './shared/models/dashboard.model';
```

Add `AsyncPipe` to the `imports` array in `@Component` decorator (if not already present).

Inject in constructor:
```typescript
constructor(
  // ... existing injections ...,
  public userState: UserStateService,
) {}
```

In the template, replace the hardcoded XP widget with live bindings. Find the sidebar XP widget section — it shows something like:
```html
NEXT LEVEL IN / 550 XP
```

Replace it with:
```html
@if (userState.xp$ | async; as xp) {
  <div class="xp-widget">
    <div class="xp-label">NEXT LEVEL IN</div>
    <div class="xp-amount">{{ xp.xpForNextLevel - xp.xpInLevel }} XP</div>
    <div class="xp-bar-track">
      <div class="xp-bar-fill" [style.width.%]="xp.xpPercent"></div>
    </div>
  </div>
} @else {
  <!-- skeleton while loading -->
  <div class="xp-widget">
    <div class="xp-label">NEXT LEVEL IN</div>
    <div class="xp-amount">— XP</div>
    <div class="xp-bar-track">
      <div class="xp-bar-fill" style="width: 0%"></div>
    </div>
  </div>
}
```

Keep all class names matching the existing CSS — do not rename them.

- [ ] **Step 4: Publish XP to UserStateService from DashboardComponent**

Open `frontend/src/app/dashboard/dashboard.component.ts` and find the `loadData()` method (where `getDashboard()` response is handled).

Add import:
```typescript
import { UserStateService } from '../shared/services/user-state.service';
```

Inject in constructor:
```typescript
private userState: UserStateService,
```

In `loadData()`, inside the `.subscribe({ next: (data) => { ... } })` block, add:
```typescript
if (data.xp) {
  this.userState.setXp(data.xp);
}
```

- [ ] **Step 5: Build and verify**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: build succeeds with no errors.

---

## Task 8: Dashboard Live Quests + Hero XP

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `DashboardData.xp: XpInfo`, `DashboardData.dailyMissions: DailyMissionItem[]` from Task 6
- Produces: Hero card level badge + XP bar bound to live data; quests section bound to `dailyMissions` array

- [ ] **Step 1: Read DashboardComponent to find the relevant template sections**

Use the Read tool on `frontend/src/app/dashboard/dashboard.component.ts` to identify:
1. The hero card section — find where `level`, `levelTitle`, and the XP progress bar are rendered (currently computed from `totalPoints`)
2. The quests section — find the 3 hardcoded quest items

- [ ] **Step 2: Expose XP and missions from component data**

In the component class, after the `loadData()` assigns `this.data = data`, expose helpers for the template. Find the existing level computation (currently from `totalPoints`) and the `getLevel()` method (or equivalent). If they exist, remove or replace them with XP-based versions.

Add these computed getters:
```typescript
get level(): number { return this.data?.xp?.level ?? 1; }
get levelTitle(): string { return this.data?.xp?.levelTitle ?? 'ROOKIE'; }
get xpPercent(): number { return this.data?.xp?.xpPercent ?? 0; }
get xpInLevel(): number { return this.data?.xp?.xpInLevel ?? 0; }
get xpForNextLevel(): number { return this.data?.xp?.xpForNextLevel ?? 200; }
get dailyMissions() { return this.data?.dailyMissions ?? []; }
```

- [ ] **Step 3: Update hero card template bindings**

In the component template, find the hero card section and update it so:

- Level badge text reads `⚡ LEVEL {{ level }} · {{ levelTitle }}`
- XP bar width uses `[style.width.%]="xpPercent"`
- XP label reads `{{ xpInLevel }} XP → LV {{ level + 1 }}`

Leave total points display untouched — it is still leaderboard points, not XP.

- [ ] **Step 4: Replace hardcoded quests with dailyMissions binding**

Find the quests section in the template (3 hardcoded `<div class="quest-item">` or similar elements). Replace with:

```html
@for (mission of dailyMissions; track mission.id) {
  <div class="quest-item" [class.completed]="mission.completed">
    <div class="quest-header">
      <span class="quest-tier" [class]="'tier-' + mission.tier">
        {{ mission.tier | uppercase }}
      </span>
      <span class="quest-xp">+{{ mission.xpReward }} XP</span>
    </div>
    <div class="quest-desc">{{ mission.description }}</div>
    <div class="quest-progress-track">
      <div class="quest-progress-fill"
           [style.width.%]="mission.completed ? 100 : (mission.progress / mission.progressMax * 100 | number:'1.0-0')">
      </div>
    </div>
    @if (mission.completed) {
      <div class="quest-complete-label">✓ COMPLETE</div>
    }
  </div>
}
```

Add these CSS rules for the tier colours (in the component's styles, not global):
```scss
.tier-easy   { color: #C6E63B; }
.tier-medium { color: #2E6BE6; }
.tier-hard   { color: #FF6A00; }

.quest-item.completed .quest-desc { text-decoration: line-through; opacity: 0.6; }
.quest-progress-fill { background: #C6E63B; height: 100%; border-radius: 4px; transition: width 0.4s ease; }
```

- [ ] **Step 5: Build and check budget**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: build succeeds. If component style budget is exceeded, increase `maximumWarning` in `angular.json` (it is already set to 8KB/16KB from earlier).

---

## Task 9: Log Activity XP Display + Mission Toasts

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: `LogActivityResponse.xpEarned`, `LogActivityResponse.missionsCompleted` from Task 6; `MatSnackBar` for toasts
- Produces: Confirmation overlay shows `+N XP` below points; mission completion toasts appear after logging

- [ ] **Step 1: Read the dialog component to find the confirmation overlay and API call**

Use the Read tool on `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` to identify:
1. The `logActivity()` / submit method — where the API call is made
2. The `conf` object — where `pts` is stored for the confirmation overlay
3. The confirmation overlay template section — where `+{{ conf.pts }}` is shown
4. The existing imports (to see if `MatSnackBar` is already imported)

- [ ] **Step 2: Add xp to the confirmation state**

Find where the confirmation state object is defined. It currently holds something like `{ pts: number }`. Extend it:
```typescript
conf: { pts: number; xp: number } = { pts: 0, xp: 0 };
```

In the `imports` array on `@Component`, add `MatSnackBarModule` (or `MatSnackBar` directly) if not already present:
```typescript
import { MatSnackBarModule } from '@angular/material/snack-bar';
// Add MatSnackBarModule to the imports array
```

Inject `MatSnackBar` in the constructor:
```typescript
private snackBar: MatSnackBar,
```

- [ ] **Step 3: Store xpEarned and show mission toasts after submit**

In the submit method, find the `.subscribe({ next: (result) => { ... } })` block. After setting `this.conf.pts = result.points`, add:
```typescript
this.conf.xp = result.xpEarned ?? 0;

if (result.missionsCompleted?.length) {
  result.missionsCompleted.forEach((m, i) => {
    setTimeout(() => {
      this.snackBar.open(
        `Quest complete! ${m.description} · +${m.xpEarned} XP`,
        '',
        { duration: 3500, panelClass: 's4y-toast' }
      );
    }, i * 600);
  });
}
```

- [ ] **Step 4: Show +XP in confirmation overlay template**

Find the confirmation overlay section in the template. It currently shows something like:
```html
<div class="conf-pts">+{{ conf.pts }}</div>
<div class="conf-pts-label">PTS</div>
```

Add below it:
```html
@if (conf.xp > 0) {
  <div class="conf-xp">+{{ conf.xp }} XP</div>
}
```

Add the CSS in the component styles:
```scss
.conf-xp {
  font-family: 'Chakra Petch', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: #C6E63B;
  letter-spacing: 0.05em;
  margin-top: 4px;
}
```

- [ ] **Step 5: Add toast styles to global styles.scss**

Open `frontend/src/styles.scss` and add:
```scss
.s4y-toast .mdc-snackbar__surface {
  background: #1a2d54 !important;
  color: #C6E63B !important;
  font-family: 'Chakra Petch', sans-serif !important;
  font-size: 0.85rem !important;
  border: 1px solid #C6E63B40 !important;
}
```

- [ ] **Step 6: Final build and smoke test**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: build succeeds.

Start both servers and test the golden path:
1. Open the app, register a user
2. Log a 5 km run — confirm overlay shows `+500 PTS` and `+100 XP`
3. Check if any mission toast appears (depends on today's assigned missions)
4. Navigate to dashboard — verify hero card shows level/XP bar, quests section shows today's 3 missions with progress
5. Check sidebar — verify XP widget shows live data (not "550 XP")

---

## Spec Coverage Self-Check

| Spec requirement | Covered by |
|-----------------|-----------|
| XP formulas (running×20, walking×10, cycling×5, swimming×3, gym×2, steps/500) | Task 2 — `CalculateActivityXp` + unit tests |
| 10-level system with exact thresholds | Task 2 — `GetLevelInfo` + unit tests |
| `POST /api/activities` returns `xpEarned` + `missionsCompleted` | Tasks 3–4 |
| `GET /api/users/{id}/dashboard` returns `xp` + `dailyMissions` | Task 5 |
| 30-mission pool (10 Easy + 10 Medium + 10 Hard) | Task 1 — `DataSeeder.SeedMissions` |
| Deterministic mission selection (userId + date seed) | Task 3 — `SelectDailyMissions` + `StableSeed` |
| Mission evaluation (all 6 requirement types) | Task 3 — `EvaluateMission` |
| Sweep bonus +100 XP when all 3 complete | Task 3 — `EvaluateDailyMissionsAsync` |
| Daily mission progress in dashboard | Task 3 — `GetDailyMissionStatusAsync` |
| Sidebar live XP widget | Task 7 |
| Dashboard hero card level + XP bar from XP (not points) | Task 8 |
| Dashboard quests bound to live missions | Task 8 |
| Confirmation overlay `+N XP` | Task 9 |
| Mission completion toasts | Task 9 |
| `total_min` only counts duration-based sports (swimming + gym) | Global Constraints + Task 3 comments |
