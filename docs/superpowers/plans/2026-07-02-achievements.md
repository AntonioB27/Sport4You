# Achievement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 33-achievement system (Bronze/Silver/Gold) evaluated eagerly on every activity log, with unlock overlays in the log dialog, a dashboard widget, and a dedicated `/achievements` page.

**Architecture:** Achievements are seeded rows in a new `Achievement` table; `AchievementService.EvaluateAchievementsAsync` computes all-time aggregates in one pass and batch-saves newly unlocked `UserAchievement` rows + XP in a single `SaveChangesAsync` call. `ActivityService.LogActivityAsync` calls it after missions. The frontend queues unlock overlays inside `LogActivityDialogComponent`, displays the 3 most recent on the dashboard, and shows the full grid at `/achievements`.

**Tech Stack:** C# 12 / ASP.NET Core 8 / EF Core 8 / SQLite · Angular 17 standalone components · Angular Material

## Global Constraints

- Delete `backend/sport4you.db` before running after schema changes — `EnsureCreated()` does not migrate existing DBs
- All C# records use positional constructor syntax (no `{ get; init; }` properties)
- Angular components are standalone — add every dependency to `imports: [...]`
- Run backend tests with: `dotnet test backend/Sport4You.Tests` from the repo root
- Run frontend build check with: `npx ng build --configuration development` from `frontend/`
- Backend port: `http://localhost:5262`
- `DataSeeder.SeedAchievements()` guard: `if (db.Achievements.Any()) return;`
- Test usernames use `Guid.NewGuid().ToString("N")[..6]` suffix to avoid 409 collisions
- Integration tests resolve services from `_factory.Services.CreateScope()` — always `using` the scope

---

## File Map

**Create:**
- `backend/Sport4You.Api/Models/Achievement.cs`
- `backend/Sport4You.Api/Models/UserAchievement.cs`
- `backend/Sport4You.Api/Services/IAchievementService.cs`
- `backend/Sport4You.Api/Services/AchievementService.cs`
- `backend/Sport4You.Api/Controllers/AchievementsController.cs`
- `backend/Sport4You.Tests/AchievementServiceTests.cs`
- `frontend/src/app/achievements/achievements.component.ts`

**Modify:**
- `backend/Sport4You.Api/Data/AppDbContext.cs` — add 2 DbSets + model config
- `backend/Sport4You.Api/Data/DataSeeder.cs` — add `SeedAchievements()`
- `backend/Sport4You.Api/Services/IXpService.cs` — add `AwardGenericXpAsync`
- `backend/Sport4You.Api/Services/XpService.cs` — implement `AwardGenericXpAsync`
- `backend/Sport4You.Api/Services/IActivityService.cs` — extend `ActivityResult`
- `backend/Sport4You.Api/Services/ActivityService.cs` — call evaluator
- `backend/Sport4You.Api/Controllers/ActivitiesController.cs` — include achievements in response
- `backend/Sport4You.Api/DTOs/DashboardDto.cs` — add `UnlockedAchievementDto`, `AchievementStatusDto`, `recentAchievements`
- `backend/Sport4You.Api/Services/DashboardService.cs` — fetch recent achievements
- `backend/Sport4You.Api/Program.cs` — register `IAchievementService`
- `frontend/src/app/shared/models/dashboard.model.ts` — add `UnlockedAchievement`, `AchievementStatus`
- `frontend/src/app/shared/services/api.service.ts` — add `getAchievements()`
- `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` — achievement overlay queue
- `frontend/src/app/dashboard/dashboard.component.ts` — recent achievements widget
- `frontend/src/app/app.routes.ts` — add `/achievements` route
- `frontend/src/app/app.component.ts` — add Achievements nav link

---

### Task 1: DB Models + Seed Data

**Files:**
- Create: `backend/Sport4You.Api/Models/Achievement.cs`
- Create: `backend/Sport4You.Api/Models/UserAchievement.cs`
- Modify: `backend/Sport4You.Api/Data/AppDbContext.cs`
- Modify: `backend/Sport4You.Api/Data/DataSeeder.cs`
- Test: `backend/Sport4You.Tests/AchievementServiceTests.cs` (seed count check only)

**Interfaces:**
- Produces: `Achievement` entity, `UserAchievement` entity, `AppDbContext.Achievements`, `AppDbContext.UserAchievements`, 33 seeded rows

- [ ] **Step 1: Create `Achievement.cs`**

```csharp
// backend/Sport4You.Api/Models/Achievement.cs
namespace Sport4You.Api.Models;

public class Achievement
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = string.Empty;           // "bronze" | "silver" | "gold"
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string RequirementType { get; set; } = string.Empty;
    public double RequirementValue { get; set; }
    public string? Sport { get; set; }                          // null for cross-sport achievements
    public int XpReward { get; set; }
}
```

- [ ] **Step 2: Create `UserAchievement.cs`**

```csharp
// backend/Sport4You.Api/Models/UserAchievement.cs
namespace Sport4You.Api.Models;

public class UserAchievement
{
    public Guid UserId { get; set; }
    public Guid AchievementId { get; set; }
    public DateTime UnlockedAt { get; set; }
}
```

- [ ] **Step 3: Update `AppDbContext.cs`**

Add two `DbSet` properties and configure the composite PK on `UserAchievement`. Full file after changes:

```csharp
// backend/Sport4You.Api/Data/AppDbContext.cs
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
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.FirstName, u.LastName })
            .IsUnique();

        modelBuilder.Entity<UserXp>()
            .HasKey(u => u.UserId);

        modelBuilder.Entity<UserXp>()
            .HasOne(u => u.User)
            .WithOne()
            .HasForeignKey<UserXp>(u => u.UserId);

        modelBuilder.Entity<UserMissionCompletion>()
            .HasIndex(c => new { c.UserId, c.MissionId, c.Date })
            .IsUnique();

        modelBuilder.Entity<UserAchievement>()
            .HasKey(ua => new { ua.UserId, ua.AchievementId });
    }
}
```

- [ ] **Step 4: Add `SeedAchievements()` to `DataSeeder.cs`**

Call it from `Seed()` and implement it. Full file after changes:

```csharp
// backend/Sport4You.Api/Data/DataSeeder.cs
using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db, IScoringService scoring)
    {
        SeedUsers(db, scoring);
        SeedMissions(db);
        SeedAchievements(db);
    }

    // ... SeedUsers and SeedMissions unchanged ...

    private static void SeedAchievements(AppDbContext db)
    {
        if (db.Achievements.Any()) return;

        db.Achievements.AddRange(
            // Sport Distance — Running
            A("bronze", "First Strides",   "Run 10 km total",    "total_km", 10,  "running", 50),
            A("silver", "Road Warrior",    "Run 50 km total",    "total_km", 50,  "running", 150),
            A("gold",   "Marathon Legend", "Run 200 km total",   "total_km", 200, "running", 300),
            // Sport Distance — Walking
            A("bronze", "Weekend Walker",  "Walk 20 km total",   "total_km", 20,  "walking", 50),
            A("silver", "Trail Blazer",    "Walk 100 km total",  "total_km", 100, "walking", 150),
            A("gold",   "Pathfinder",      "Walk 500 km total",  "total_km", 500, "walking", 300),
            // Sport Distance — Cycling
            A("bronze", "Casual Rider",    "Cycle 30 km total",  "total_km", 30,  "cycling", 50),
            A("silver", "Chain Breaker",   "Cycle 150 km total", "total_km", 150, "cycling", 150),
            A("gold",   "Tour Crusher",    "Cycle 500 km total", "total_km", 500, "cycling", 300),
            // Sport Duration — Swimming
            A("bronze", "Pool Diver",      "Swim 60 min total",    "total_minutes", 60,   "swimming", 50),
            A("silver", "Lap Master",      "Swim 300 min total",   "total_minutes", 300,  "swimming", 150),
            A("gold",   "Open Water",      "Swim 1,000 min total", "total_minutes", 1000, "swimming", 300),
            // Sport Duration — Gym
            A("bronze", "Iron Starter",    "Log 120 min at the gym",   "total_minutes", 120,  "gym", 50),
            A("silver", "Pump Master",     "Log 600 min at the gym",   "total_minutes", 600,  "gym", 150),
            A("gold",   "Iron Legend",     "Log 2,000 min at the gym", "total_minutes", 2000, "gym", 300),
            // Steps
            A("bronze", "First March",     "Log 50,000 steps total",    "total_steps", 50000,   null, 50),
            A("silver", "Step Hunter",     "Log 250,000 steps total",   "total_steps", 250000,  null, 150),
            A("gold",   "Steps Legend",    "Log 1,000,000 steps total", "total_steps", 1000000, null, 300),
            // Streaks
            A("bronze", "On a Roll",       "Log activity 3 days in a row",  "streak_days", 3,  null, 50),
            A("silver", "Week Warrior",    "Log activity 7 days in a row",  "streak_days", 7,  null, 150),
            A("gold",   "Iron Habit",      "Log activity 30 days in a row", "streak_days", 30, null, 300),
            // XP Journey
            A("bronze", "Leveling Up",     "Reach Level 3",  "level_reached", 3,  null, 50),
            A("silver", "Getting Serious", "Reach Level 6",  "level_reached", 6,  null, 150),
            A("gold",   "Immortal",        "Reach Level 10", "level_reached", 10, null, 300),
            // Leaderboard Feats
            A("bronze", "Top 10",          "Reach top 10 on the leaderboard", "leaderboard_rank", 10, null, 50),
            A("silver", "Podium",          "Reach top 3 on the leaderboard",  "leaderboard_rank", 3,  null, 150),
            A("gold",   "Champion",        "Reach #1 on the leaderboard",     "leaderboard_rank", 1,  null, 300),
            // One-Time Feats
            A("bronze", "First Blood",      "Log your first activity",                           "first_activity", 1,    null, 50),
            A("bronze", "Mission Possible", "Complete your first daily mission",                 "first_mission",  1,    null, 50),
            A("silver", "Triple Crown",     "Complete a daily sweep (all 3 missions in one day)","first_sweep",    1,    null, 150),
            A("silver", "All-Rounder",      "Log all 6 sport types at least once",               "all_sports",     6,    null, 150),
            A("bronze", "Century",          "Earn 1,000 points in a single day",                 "points_in_day",  1000, null, 50),
            A("gold",   "Centurion",        "Earn 10,000 points in a single day",                "points_in_day",  10000, null, 300)
        );

        db.SaveChanges();
    }

    private static Achievement A(string tier, string name, string desc,
        string reqType, double reqVal, string? sport, int xp)
        => new() { Id = Guid.NewGuid(), Tier = tier, Name = name, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp };

    // SeedUsers and SeedMissions and M() helper remain exactly as they are now
    // (copy them here unchanged — do not modify them)
}
```

> **Note:** Copy the existing `SeedUsers`, `SeedMissions`, and `M()` helper from the current file unchanged. Only add the `SeedAchievements` and `A()` helper shown above.

- [ ] **Step 5: Write seed-count test**

Create `backend/Sport4You.Tests/AchievementServiceTests.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AchievementSeedTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    public AchievementSeedTests(TestFactory factory) => _factory = factory;

    [Fact]
    public async Task Seed_Creates33Achievements()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Achievements.CountAsync();
        Assert.Equal(33, count);
    }
}
```

- [ ] **Step 6: Delete the old DB and run the test**

```bash
rm -f backend/Sport4You.Api/sport4you.db
dotnet test backend/Sport4You.Tests --filter "AchievementSeedTests" -v
```

Expected: `PASS — AchievementSeedTests.Seed_Creates33Achievements`

- [ ] **Step 7: Commit**

```bash
git add backend/Sport4You.Api/Models/Achievement.cs \
        backend/Sport4You.Api/Models/UserAchievement.cs \
        backend/Sport4You.Api/Data/AppDbContext.cs \
        backend/Sport4You.Api/Data/DataSeeder.cs \
        backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: add Achievement and UserAchievement models, seed 33 achievements"
```

---

### Task 2: `AwardGenericXpAsync` on `IXpService`

**Files:**
- Modify: `backend/Sport4You.Api/Services/IXpService.cs`
- Modify: `backend/Sport4You.Api/Services/XpService.cs`
- Test: `backend/Sport4You.Tests/XpServiceTests.cs` (add one integration test)

**Interfaces:**
- Consumes: `AppDbContext.UserXp`, `AppDbContext.XpTransactions` (already exist)
- Produces: `IXpService.AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId): Task<int>`

- [ ] **Step 1: Add method to `IXpService.cs`**

Append one line to the interface (after `GetDailyMissionStatusAsync`):

```csharp
// In IXpService.cs — add to the interface body:
Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId);
```

Full interface after change:

```csharp
// backend/Sport4You.Api/Services/IXpService.cs
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
    int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps);
    LevelInfo GetLevelInfo(int totalXp);
    Task<int> AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps);
    Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date);
    Task<XpSummary> GetXpSummaryAsync(Guid userId);
    Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date);
    Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId);
}
```

- [ ] **Step 2: Implement `AwardGenericXpAsync` in `XpService.cs`**

Add this method inside the `XpService` class, after `GetDailyMissionStatusAsync`:

```csharp
public async Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId)
{
    var now = DateTime.UtcNow;
    var row = await _db.UserXp.FindAsync(userId);
    if (row == null)
        _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xp, UpdatedAt = now });
    else
    {
        row.TotalXp += xp;
        row.UpdatedAt = now;
    }

    _db.XpTransactions.Add(new XpTransaction
    {
        Id = Guid.NewGuid(), UserId = userId, Source = source,
        SourceId = sourceId, XpEarned = xp, CreatedAt = now,
    });

    await _db.SaveChangesAsync();
    return xp;
}
```

- [ ] **Step 3: Write failing integration test**

Add to `XpServiceIntegrationTests` in `backend/Sport4You.Tests/XpServiceTests.cs`:

```csharp
[Fact]
public async Task AwardGenericXp_UpdatesUserXpAndCreatesTransaction()
{
    var userId = await CreateUserAsync();
    using var scope = _client.GetType()
        .GetField("_factory", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
        ?.GetValue(_client) is TestFactory f ? f.Services.CreateScope() : throw new Exception("no factory");
    // Simpler: resolve via the factory field injected in constructor
}
```

> **Note:** The `XpServiceIntegrationTests` class only has `_client`. For service-level integration tests, add a constructor overload that also stores `_factory`:

Replace the `XpServiceIntegrationTests` class constructor:

```csharp
public class XpServiceIntegrationTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    private readonly TestFactory _factory;

    public XpServiceIntegrationTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> CreateUserAsync()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Xp", lastName = suffix });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task AwardGenericXp_UpdatesUserXpAndCreatesTransaction()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        using var scope = _factory.Services.CreateScope();
        var xpSvc = scope.ServiceProvider.GetRequiredService<IXpService>();
        var db = scope.ServiceProvider.GetRequiredService<Sport4You.Api.Data.AppDbContext>();

        var sourceId = Guid.NewGuid();
        var earned = await xpSvc.AwardGenericXpAsync(userId, 150, "achievement", sourceId);

        Assert.Equal(150, earned);
        var row = await db.UserXp.FindAsync(userId);
        Assert.NotNull(row);
        Assert.Equal(150, row!.TotalXp);
        var tx = db.XpTransactions.FirstOrDefault(t => t.SourceId == sourceId);
        Assert.NotNull(tx);
        Assert.Equal("achievement", tx!.Source);
    }

    // Keep existing LogActivity_ReturnsXpEarned and LogActivity_ReturnsMissionsCompletedArray tests unchanged
}
```

- [ ] **Step 4: Run tests**

```bash
dotnet test backend/Sport4You.Tests -v
```

Expected: all tests pass including the new `AwardGenericXp_UpdatesUserXpAndCreatesTransaction`.

- [ ] **Step 5: Commit**

```bash
git add backend/Sport4You.Api/Services/IXpService.cs \
        backend/Sport4You.Api/Services/XpService.cs \
        backend/Sport4You.Tests/XpServiceTests.cs
git commit -m "feat: add AwardGenericXpAsync to IXpService for standalone XP grants"
```

---

### Task 3: `IAchievementService` + `AchievementService` + Registration

**Files:**
- Create: `backend/Sport4You.Api/Services/IAchievementService.cs`
- Create: `backend/Sport4You.Api/Services/AchievementService.cs`
- Modify: `backend/Sport4You.Api/Program.cs`
- Modify: `backend/Sport4You.Tests/AchievementServiceTests.cs`

**Interfaces:**
- Consumes: `AppDbContext.Achievements`, `AppDbContext.UserAchievements`, `AppDbContext.Activities`, `AppDbContext.UserXp`, `AppDbContext.XpTransactions`, `AppDbContext.UserMissionCompletions`, `IXpService.GetLevelInfo`
- Produces:
  - `UnlockedAchievementDto(Guid Id, string Tier, string Name, string Description, int XpReward)` — in `IAchievementService.cs`
  - `AchievementStatusDto(Guid Id, string Tier, string Name, string Description, string RequirementType, int XpReward, bool Unlocked, DateTime? UnlockedAt)` — in `IAchievementService.cs`
  - `IAchievementService.EvaluateAchievementsAsync(Guid userId): Task<List<UnlockedAchievementDto>>`
  - `IAchievementService.GetUserAchievementsAsync(Guid userId): Task<List<AchievementStatusDto>>`

- [ ] **Step 1: Create `IAchievementService.cs`**

```csharp
// backend/Sport4You.Api/Services/IAchievementService.cs
namespace Sport4You.Api.Services;

public record UnlockedAchievementDto(Guid Id, string Tier, string Name, string Description, int XpReward);
public record AchievementStatusDto(
    Guid Id, string Tier, string Name, string Description,
    string RequirementType, int XpReward, bool Unlocked, DateTime? UnlockedAt);

public interface IAchievementService
{
    Task<List<UnlockedAchievementDto>> EvaluateAchievementsAsync(Guid userId);
    Task<List<AchievementStatusDto>> GetUserAchievementsAsync(Guid userId);
}
```

- [ ] **Step 2: Create `AchievementService.cs`**

```csharp
// backend/Sport4You.Api/Services/AchievementService.cs
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class AchievementService : IAchievementService
{
    private readonly AppDbContext _db;
    private readonly IXpService _xp;

    public AchievementService(AppDbContext db, IXpService xp)
    {
        _db = db;
        _xp = xp;
    }

    public async Task<List<AchievementStatusDto>> GetUserAchievementsAsync(Guid userId)
    {
        var all = await _db.Achievements.ToListAsync();
        var earned = await _db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
        var earnedMap = earned.ToDictionary(ua => ua.AchievementId);

        return all.Select(a =>
        {
            earnedMap.TryGetValue(a.Id, out var ua);
            return new AchievementStatusDto(
                a.Id, a.Tier, a.Name, a.Description, a.RequirementType,
                a.XpReward, ua != null, ua?.UnlockedAt);
        }).ToList();
    }

    public async Task<List<UnlockedAchievementDto>> EvaluateAchievementsAsync(Guid userId)
    {
        // Load unearned achievements
        var earnedIds = await _db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();

        var unearned = await _db.Achievements
            .Where(a => !earnedIds.Contains(a.Id))
            .ToListAsync();

        if (unearned.Count == 0) return [];

        // Compute all-time aggregates
        var allActivities = await _db.Activities
            .Where(a => a.UserId == userId)
            .ToListAsync();

        var totalKmBySport = allActivities
            .Where(a => a.Distance.HasValue)
            .GroupBy(a => a.Sport.ToLower())
            .ToDictionary(g => g.Key, g => (double)g.Sum(a => a.Distance!.Value));

        var totalMinBySport = allActivities
            .Where(a => a.Duration != null)
            .GroupBy(a => a.Sport.ToLower())
            .ToDictionary(g => g.Key, g => g.Sum(a => ParseMinutes(a.Duration!)));

        var totalSteps = allActivities.Sum(a => a.Steps ?? 0);
        var distinctSports = allActivities.Select(a => a.Sport.ToLower()).Distinct().Count();
        var maxPointsInDay = allActivities.Count == 0 ? 0
            : allActivities
                .GroupBy(a => DateOnly.FromDateTime(a.DateTime.ToUniversalTime()))
                .Select(g => g.Sum(a => a.Points))
                .Max();

        var streak = ComputeCurrentStreak(allActivities.Select(a => a.DateTime));

        var xpRow = await _db.UserXp.FindAsync(userId);
        var level = _xp.GetLevelInfo(xpRow?.TotalXp ?? 0).Level;

        var allUserPoints = await _db.Activities
            .GroupBy(a => a.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(a => a.Points) })
            .OrderByDescending(x => x.Total)
            .ToListAsync();
        var myIdx = allUserPoints.FindIndex(x => x.UserId == userId);
        var rank = myIdx >= 0 ? myIdx + 1 : allUserPoints.Count + 1;

        var hasMission = await _db.UserMissionCompletions.AnyAsync(c => c.UserId == userId);
        var hasSweep = await _db.XpTransactions
            .AnyAsync(t => t.UserId == userId && t.Source == "mission_sweep");

        // Evaluate + batch-save
        var toUnlock = new List<Achievement>();
        foreach (var a in unearned)
        {
            var sport = a.Sport?.ToLower();
            bool meets = a.RequirementType switch
            {
                "total_km"         => sport != null && totalKmBySport.GetValueOrDefault(sport) >= a.RequirementValue,
                "total_minutes"    => sport != null && totalMinBySport.GetValueOrDefault(sport) >= a.RequirementValue,
                "total_steps"      => totalSteps >= a.RequirementValue,
                "streak_days"      => streak >= a.RequirementValue,
                "level_reached"    => level >= a.RequirementValue,
                "leaderboard_rank" => rank <= a.RequirementValue,
                "first_activity"   => allActivities.Count >= a.RequirementValue,
                "first_mission"    => hasMission,
                "first_sweep"      => hasSweep,
                "all_sports"       => distinctSports >= a.RequirementValue,
                "points_in_day"    => maxPointsInDay >= a.RequirementValue,
                _                  => false,
            };
            if (meets) toUnlock.Add(a);
        }

        if (toUnlock.Count == 0) return [];

        var now = DateTime.UtcNow;
        var totalXpToAward = 0;
        var result = new List<UnlockedAchievementDto>();

        foreach (var a in toUnlock)
        {
            _db.UserAchievements.Add(new UserAchievement
            {
                UserId = userId, AchievementId = a.Id, UnlockedAt = now,
            });
            _db.XpTransactions.Add(new XpTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Source = "achievement",
                SourceId = a.Id, XpEarned = a.XpReward, CreatedAt = now,
            });
            totalXpToAward += a.XpReward;
            result.Add(new UnlockedAchievementDto(a.Id, a.Tier, a.Name, a.Description, a.XpReward));
        }

        // Update UserXp in one shot
        var row = await _db.UserXp.FindAsync(userId);
        if (row == null)
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = totalXpToAward, UpdatedAt = now });
        else
        {
            row.TotalXp += totalXpToAward;
            row.UpdatedAt = now;
        }

        await _db.SaveChangesAsync();
        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static int ComputeCurrentStreak(IEnumerable<DateTime> activityDateTimes)
    {
        var dates = activityDateTimes
            .Select(d => DateOnly.FromDateTime(d.ToUniversalTime()))
            .Distinct()
            .OrderByDescending(d => d)
            .ToList();

        if (dates.Count == 0) return 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Streak must end today or yesterday (activity just logged = today)
        if (dates[0] != today && dates[0] != today.AddDays(-1)) return 0;

        var streak = 0;
        var expected = dates[0];
        foreach (var date in dates)
        {
            if (date == expected) { streak++; expected = expected.AddDays(-1); }
            else break;
        }
        return streak;
    }

    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
```

- [ ] **Step 3: Register in `Program.cs`**

Add one line after `builder.Services.AddScoped<IXpService, XpService>();`:

```csharp
builder.Services.AddScoped<IAchievementService, AchievementService>();
```

- [ ] **Step 4: Write integration tests**

Replace the `AchievementSeedTests` class in `backend/Sport4You.Tests/AchievementServiceTests.cs` with the full file:

```csharp
// backend/Sport4You.Tests/AchievementServiceTests.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AchievementServiceTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    private readonly HttpClient _client;

    public AchievementServiceTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Seed_Creates33Achievements()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Achievements.CountAsync();
        Assert.Equal(33, count);
    }

    [Fact]
    public async Task GetUserAchievements_ReturnsAll33WithLockedState()
    {
        var userId = await CreateUserAsync();
        using var scope = _factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var list = await svc.GetUserAchievementsAsync(Guid.Parse(userId));
        Assert.Equal(33, list.Count);
        Assert.All(list, a => Assert.False(a.Unlocked));
    }

    [Fact]
    public async Task EvaluateAchievements_FirstActivity_UnlocksFirstBlood()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running",
            Distance = 5.0m, Points = 500,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var result = await svc.EvaluateAchievementsAsync(userId);

        Assert.Contains(result, a => a.Name == "First Blood");
    }

    [Fact]
    public async Task EvaluateAchievements_Idempotent_DoesNotDoubleUnlock()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running",
            Distance = 5.0m, Points = 500,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var first = await svc.EvaluateAchievementsAsync(userId);
        var second = await svc.EvaluateAchievementsAsync(userId);

        var firstBloodCount = first.Count(a => a.Name == "First Blood")
                            + second.Count(a => a.Name == "First Blood");
        Assert.Equal(1, firstBloodCount);
    }

    [Fact]
    public async Task EvaluateAchievements_RunningMilestone_UnlocksFirstStrides()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Log exactly 10 km of running
        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running",
            Distance = 10.0m, Points = 1000,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var result = await svc.EvaluateAchievementsAsync(userId);

        Assert.Contains(result, a => a.Name == "First Strides");
        Assert.DoesNotContain(result, a => a.Name == "Road Warrior");  // needs 50 km
    }

    [Fact]
    public async Task EvaluateAchievements_AwardsXpForUnlock()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running",
            Distance = 5.0m, Points = 500,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var unlocked = await svc.EvaluateAchievementsAsync(userId);

        var totalExpectedXp = unlocked.Sum(a => a.XpReward);
        var xpRow = await db.UserXp.FindAsync(userId);
        Assert.NotNull(xpRow);
        Assert.Equal(totalExpectedXp, xpRow!.TotalXp);
    }

    private async Task<string> CreateUserAsync()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Ach", lastName = suffix });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }
}
```

- [ ] **Step 5: Run tests**

```bash
dotnet test backend/Sport4You.Tests -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/IAchievementService.cs \
        backend/Sport4You.Api/Services/AchievementService.cs \
        backend/Sport4You.Api/Program.cs \
        backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: add AchievementService with evaluation engine and XP batch award"
```

---

### Task 4: Wire Achievement Evaluation into Activity Logging

**Files:**
- Modify: `backend/Sport4You.Api/Services/IActivityService.cs`
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs`
- Modify: `backend/Sport4You.Api/Controllers/ActivitiesController.cs`
- Test: `backend/Sport4You.Tests/AchievementServiceTests.cs` (add HTTP-level test)

**Interfaces:**
- Consumes: `IAchievementService.EvaluateAchievementsAsync`, `UnlockedAchievementDto` (both from Task 3)
- Produces: `ActivityResult.AchievementsUnlocked: List<UnlockedAchievementDto>`, `POST /api/activities` response gains `achievementsUnlocked` array

- [ ] **Step 1: Extend `ActivityResult` in `IActivityService.cs`**

```csharp
// backend/Sport4You.Api/Services/IActivityService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points,
    int XpEarned, List<CompletedMissionDto> MissionsCompleted,
    List<UnlockedAchievementDto> AchievementsUnlocked)
{
    public static ActivityResult Success(
        Guid id, int points, int xpEarned,
        List<CompletedMissionDto> missions,
        List<UnlockedAchievementDto> achievements)
        => new(false, false, null, id, points, xpEarned, missions, achievements);

    public static ActivityResult BadRequest(string error)
        => new(true, false, error, Guid.Empty, 0, 0, [], []);

    public static ActivityResult NotFound(string error)
        => new(true, true, error, Guid.Empty, 0, 0, [], []);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
```

- [ ] **Step 2: Update `ActivityService.cs`**

Add `IAchievementService` constructor parameter and call it after missions. Full file:

```csharp
// backend/Sport4You.Api/Services/ActivityService.cs
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
    private readonly IAchievementService _achievements;

    public ActivityService(
        IUserRepository users, IActivityRepository activities,
        IScoringService scoring, IXpService xp, IAchievementService achievements)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
        _xp = xp;
        _achievements = achievements;
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

        var newAchievements = await _achievements.EvaluateAchievementsAsync(userId);

        return ActivityResult.Success(
            activity.Id, points, xpEarned,
            missionResult.NewlyCompleted, newAchievements);
    }

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
            if (!IsValidDuration(r.Duration))
                return (false, "Duration must be in mm:ss format", string.Empty);
            return (true, null, sport!);
        }

        return (false, $"Unknown sport: {sport}", string.Empty);
    }

    private static bool IsValidDuration(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length == 2
            && int.TryParse(parts[0], out var minutes) && minutes >= 0
            && int.TryParse(parts[1], out var seconds) && seconds is >= 0 and < 60;
    }
}
```

- [ ] **Step 3: Update `ActivitiesController.cs`**

```csharp
// backend/Sport4You.Api/Controllers/ActivitiesController.cs
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityService _activities;
    public ActivitiesController(IActivityService activities) => _activities = activities;

    [HttpPost]
    public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest request)
    {
        var result = await _activities.LogActivityAsync(request);
        if (result.IsNotFound)
            return NotFound(new { error = result.Error });
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new
        {
            activityId = result.ActivityId,
            points = result.Points,
            xpEarned = result.XpEarned,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
        });
    }
}
```

- [ ] **Step 4: Add HTTP-level test**

Add to `AchievementServiceTests.cs`:

```csharp
[Fact]
public async Task LogActivity_ResponseContainsAchievementsUnlockedArray()
{
    var suffix = Guid.NewGuid().ToString("N")[..6];
    var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "Wire", lastName = suffix });
    var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
    var userId = regBody!["userId"];

    var r = await _client.PostAsJsonAsync("/api/activities", new
    {
        userId,
        datetime = DateTime.UtcNow.ToString("o"),
        sport = "running",
        distance = 5.0,
    });

    Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
    var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var achievements = body.GetProperty("achievementsUnlocked");
    Assert.Equal(System.Text.Json.JsonValueKind.Array, achievements.ValueKind);
    // First activity → "First Blood" must be in the array
    var names = achievements.EnumerateArray()
        .Select(a => a.GetProperty("name").GetString())
        .ToList();
    Assert.Contains("First Blood", names);
}
```

- [ ] **Step 5: Run tests**

```bash
dotnet test backend/Sport4You.Tests -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/IActivityService.cs \
        backend/Sport4You.Api/Services/ActivityService.cs \
        backend/Sport4You.Api/Controllers/ActivitiesController.cs \
        backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: wire achievement evaluation into activity logging pipeline"
```

---

### Task 5: Dashboard `recentAchievements` + `GET /achievements` Endpoint

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs`
- Modify: `backend/Sport4You.Api/Services/DashboardService.cs`
- Create: `backend/Sport4You.Api/Controllers/AchievementsController.cs`
- Test: `backend/Sport4You.Tests/AchievementServiceTests.cs`

**Interfaces:**
- Consumes: `IAchievementService.GetUserAchievementsAsync`, `AchievementStatusDto` (Task 3)
- Produces:
  - `DashboardDto.RecentAchievements: List<AchievementStatusDto>` (3 most recent)
  - `GET /api/users/{userId}/achievements → List<AchievementStatusDto>`

- [ ] **Step 1: Add `AchievementStatusDto` import and `RecentAchievements` to `DashboardDto.cs`**

Add at the bottom of `DashboardDto.cs` (the `UnlockedAchievementDto` and `AchievementStatusDto` records live in `IAchievementService.cs`, so import the namespace):

```csharp
// backend/Sport4You.Api/DTOs/DashboardDto.cs
using Sport4You.Api.Services;

namespace Sport4You.Api.DTOs;

public class DashboardDto
{
    public UserInfoDto User { get; set; } = new();
    public int TotalPoints { get; set; }
    public List<ActivityDto> Activities { get; set; } = [];
    public List<PointsOverTimeDto> PointsOverTime { get; set; } = [];
    public List<SportBreakdownDto> SportBreakdown { get; set; } = [];
    public XpDto Xp { get; set; } = new();
    public List<DailyMissionDto> DailyMissions { get; set; } = [];
    public List<AchievementStatusDto> RecentAchievements { get; set; } = [];
}

// ... rest of DashboardDto.cs unchanged (UserInfoDto, ActivityDto, etc.) ...
```

> **Note:** Keep all existing records in `DashboardDto.cs` (UserInfoDto, ActivityDto, PointsOverTimeDto, SportBreakdownDto, CompletedMissionDto, XpDto, DailyMissionDto) exactly as they are. Only add `using Sport4You.Api.Services;` at the top and `public List<AchievementStatusDto> RecentAchievements { get; set; } = [];` to `DashboardDto`.

- [ ] **Step 2: Update `DashboardService.cs`**

Add `IAchievementService _achievements` to constructor and fetch recent achievements. Full file:

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

    public DashboardService(
        IUserRepository users, IActivityRepository activities,
        IXpService xp, IAchievementService achievements)
    {
        _users = users;
        _activities = activities;
        _xp = xp;
        _achievements = achievements;
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
            .Take(3)
            .ToList();

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
        };
    }
}
```

- [ ] **Step 3: Create `AchievementsController.cs`**

```csharp
// backend/Sport4You.Api/Controllers/AchievementsController.cs
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class AchievementsController : ControllerBase
{
    private readonly IAchievementService _achievements;
    public AchievementsController(IAchievementService achievements)
        => _achievements = achievements;

    [HttpGet("achievements")]
    public async Task<IActionResult> GetAchievements(Guid userId)
    {
        var result = await _achievements.GetUserAchievementsAsync(userId);
        return Ok(result);
    }
}
```

- [ ] **Step 4: Write tests**

Add to `AchievementServiceTests.cs`:

```csharp
[Fact]
public async Task GetAchievementsEndpoint_Returns33Items()
{
    var suffix = Guid.NewGuid().ToString("N")[..6];
    var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "EndpT", lastName = suffix });
    var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
    var userId = regBody!["userId"];

    var r = await _client.GetAsync($"/api/users/{userId}/achievements");
    Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

    var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    Assert.Equal(System.Text.Json.JsonValueKind.Array, body.ValueKind);
    Assert.Equal(33, body.GetArrayLength());
}

[Fact]
public async Task Dashboard_ContainsRecentAchievementsField()
{
    var suffix = Guid.NewGuid().ToString("N")[..6];
    var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "DashA", lastName = suffix });
    var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
    var userId = regBody!["userId"];

    var r = await _client.GetAsync($"/api/users/{userId}/dashboard");
    Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

    var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var recent = body.GetProperty("recentAchievements");
    Assert.Equal(System.Text.Json.JsonValueKind.Array, recent.ValueKind);
}
```

- [ ] **Step 5: Run tests**

```bash
dotnet test backend/Sport4You.Tests -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/DTOs/DashboardDto.cs \
        backend/Sport4You.Api/Services/DashboardService.cs \
        backend/Sport4You.Api/Controllers/AchievementsController.cs \
        backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: add GET /achievements endpoint and recentAchievements to dashboard"
```

---

### Task 6: Frontend Models + API Service

**Files:**
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`

**Interfaces:**
- Produces:
  - `UnlockedAchievement` interface
  - `AchievementStatus` interface
  - `LogActivityResponse.achievementsUnlocked: UnlockedAchievement[]`
  - `DashboardData.recentAchievements: AchievementStatus[]`
  - `ApiService.getAchievements(userId: string): Observable<AchievementStatus[]>`

- [ ] **Step 1: Update `dashboard.model.ts`**

```typescript
// frontend/src/app/shared/models/dashboard.model.ts

export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
  recentAchievements: AchievementStatus[];
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

export interface UnlockedAchievement {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  name: string;
  description: string;
  xpReward: number;
}

export interface AchievementStatus extends UnlockedAchievement {
  requirementType: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LogActivityResponse {
  activityId: string;
  points: number;
  xpEarned: number;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
}
```

- [ ] **Step 2: Update `api.service.ts`**

```typescript
// frontend/src/app/shared/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard.model';
import { AchievementStatus, DashboardData, LogActivityRequest, LogActivityResponse } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'http://localhost:5262/api';

  constructor(private http: HttpClient) {}

  registerUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users`, { firstName, lastName });
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`);
  }

  getDashboard(userId: string): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.base}/users/${userId}/dashboard`);
  }

  logActivity(request: LogActivityRequest): Observable<LogActivityResponse> {
    return this.http.post<LogActivityResponse>(`${this.base}/activities`, request);
  }

  getAchievements(userId: string): Observable<AchievementStatus[]> {
    return this.http.get<AchievementStatus[]>(`${this.base}/users/${userId}/achievements`);
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.` with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/models/dashboard.model.ts \
        frontend/src/app/shared/services/api.service.ts
git commit -m "feat: add achievement TypeScript interfaces and getAchievements API method"
```

---

### Task 7: Achievement Unlock Overlay in Log Activity Dialog

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: `UnlockedAchievement` from `dashboard.model.ts` (Task 6), `LogActivityResponse.achievementsUnlocked`
- Produces: Achievement unlock overlay shown after the activity confirmation screen, queued one at a time

**Context:** The component already shows a confirmation overlay (`.conf`) after logging. The achievement overlay sits on top of it (`z-index` higher), and the user taps through each unlocked achievement.

- [ ] **Step 1: Add achievement overlay styles**

Add these CSS rules inside the `styles: [` array, after the existing `.conf-done` rule:

```css
    /* achievement overlay */
    .ach-overlay {
      position:absolute; inset:0; border-radius:34px; z-index:50;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      text-align:center; padding:36px 30px 32px; overflow:hidden;
      background:radial-gradient(100% 60% at 50% 4%,rgba(198,230,59,.25),transparent 55%),
                 linear-gradient(180deg,#0e1a34,#1a2d54);
    }
    .ach-badge {
      display:inline-flex; align-items:center; gap:8px;
      border-radius:999px; padding:6px 18px; font-family:'Chakra Petch',sans-serif;
      font-weight:700; font-size:13px; letter-spacing:.18em; margin-bottom:16px;
    }
    .ach-badge.bronze { background:rgba(205,127,50,.18); border:1px solid #CD7F32; color:#CD7F32; }
    .ach-badge.silver { background:rgba(192,192,192,.18); border:1px solid #C0C0C0; color:#C0C0C0; }
    .ach-badge.gold   { background:rgba(255,215,0,.18);   border:1px solid #FFD700; color:#FFD700; }
    .ach-title { font-family:'Chakra Petch',sans-serif; font-size:30px; font-weight:700; color:#fff; line-height:1.1; margin-bottom:8px; }
    .ach-desc  { font-family:'Nunito',sans-serif; font-size:14px; color:#a8bcd8; margin-bottom:14px; max-width:280px; }
    .ach-xp    { font-family:'Chakra Petch',sans-serif; font-size:1.1rem; font-weight:700; color:#C6E63B; letter-spacing:.05em; margin-bottom:24px; }
    .ach-next  {
      background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px;
      letter-spacing:.05em; padding:13px 34px; border-radius:14px;
      cursor:pointer; border:none; box-shadow:0 6px 0 #7c9c00;
      transition:transform .1s, box-shadow .1s;
    }
    .ach-next:active { transform:translateY(3px); box-shadow:0 3px 0 #7c9c00; }
    .ach-tag  { font-family:'Chakra Petch',sans-serif; font-size:11px; letter-spacing:.28em; font-weight:700; color:#7fa8ff; margin-bottom:10px; }
```

- [ ] **Step 2: Add achievement overlay markup**

Add the achievement overlay block inside the `.card` div, after the existing `@if (logged)` block:

```html
      <!-- Achievement unlock overlay (queued, shown on top of conf) -->
      @if (currentAchievement) {
      <div class="ach-overlay">
        <div class="ach-tag">ACHIEVEMENT UNLOCKED</div>
        <div class="ach-badge" [class]="currentAchievement.tier">
          {{ tierLabel(currentAchievement.tier) }}
        </div>
        <div class="ach-title">{{ currentAchievement.name }}</div>
        <div class="ach-desc">{{ currentAchievement.description }}</div>
        <div class="ach-xp">+{{ currentAchievement.xpReward }} XP</div>
        <button class="ach-next" (click)="nextAchievement()">
          {{ achievementQueue.length > 0 ? 'NEXT →' : 'AWESOME! 🏅' }}
        </button>
      </div>
      }
```

- [ ] **Step 3: Add achievement queue logic to the component class**

Add new fields after `earnedXp = 0`:

```typescript
  achievementQueue: UnlockedAchievement[] = [];
  currentAchievement: UnlockedAchievement | null = null;
```

Add import at the top of the file:
```typescript
import { UnlockedAchievement } from '../../models/dashboard.model';
```

Add two new methods to the class:

```typescript
  tierLabel(tier: string): string {
    return { bronze: '🥉 BRONZE', silver: '🥈 SILVER', gold: '🥇 GOLD' }[tier] ?? tier.toUpperCase();
  }

  nextAchievement(): void {
    this.currentAchievement = this.achievementQueue.shift() ?? null;
  }
```

- [ ] **Step 4: Queue achievements in `logActivity()` success handler**

In the `next:` handler of `this.api.logActivity(req).subscribe(...)`, after the existing mission toast loop, add:

```typescript
        const achievements: UnlockedAchievement[] = res.achievementsUnlocked ?? [];
        if (achievements.length > 0) {
          this.achievementQueue = achievements.slice(1);
          this.currentAchievement = achievements[0];
        }
```

The full updated `next:` handler:

```typescript
      next: (res: LogActivityResponse) => {
        this.loading = false;
        this.earnedPoints = res.points;
        this.earnedXp = res.xpEarned ?? 0;
        this.confirmedPose = sp.pose;
        this.activityLogged.notify();
        this.logged = true;

        const missions: { description: string; xpEarned: number }[] = res.missionsCompleted ?? [];
        missions.forEach((m, i) => {
          setTimeout(() => {
            this.snackBar.open(
              `Quest complete! ${m.description} · +${m.xpEarned} XP`,
              '',
              { duration: 3500, panelClass: 's4y-toast' }
            );
          }, i * 600);
        });

        const achievements: UnlockedAchievement[] = res.achievementsUnlocked ?? [];
        if (achievements.length > 0) {
          this.achievementQueue = achievements.slice(1);
          this.currentAchievement = achievements[0];
        }
      },
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts
git commit -m "feat: add achievement unlock overlay queue to log activity dialog"
```

---

### Task 8: Dashboard Recent Achievements Widget

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `DashboardData.recentAchievements: AchievementStatus[]` (Task 6), `AchievementStatus` interface

- [ ] **Step 1: Add styles for the achievements widget**

Inside the dashboard component's `styles: [` array, add after the existing `.quest-*` styles:

```css
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
```

- [ ] **Step 2: Add the widget to the template**

In the dashboard template, inside the right column (`.col:last-child`), add after the Daily Missions section:

```html
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
```

- [ ] **Step 3: Add `tierColor()` helper and `RouterLink` import to the component class**

Add `RouterLink` to the `imports` array:
```typescript
imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, RouterLink],
```

Add import at the top:
```typescript
import { RouterLink } from '@angular/router';
```

Add `tierColor` method to the class:
```typescript
  tierColor(tier: string): string {
    return { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700' }[tier] ?? '#9fb2d6';
  }
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat: add recent achievements widget to dashboard"
```

---

### Task 9: Achievements Page + Route + Nav Link

**Files:**
- Create: `frontend/src/app/achievements/achievements.component.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/app.component.ts`

**Interfaces:**
- Consumes: `ApiService.getAchievements()`, `AchievementStatus` interface (Task 6)
- Produces: `/achievements` route, "BADGES" nav link, full achievement grid grouped by category

- [ ] **Step 1: Create `achievements.component.ts`**

Create directory `frontend/src/app/achievements/` and the file:

```typescript
// frontend/src/app/achievements/achievements.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { AchievementStatus } from '../shared/models/dashboard.model';

interface AchievementCategory {
  label: string;
  types: string[];
}

const CATEGORIES: AchievementCategory[] = [
  { label: 'Sport Distance Milestones', types: ['total_km'] },
  { label: 'Sport Duration Milestones', types: ['total_minutes'] },
  { label: 'Steps Milestones',          types: ['total_steps'] },
  { label: 'Streaks',                   types: ['streak_days'] },
  { label: 'XP Journey',               types: ['level_reached'] },
  { label: 'Leaderboard Feats',         types: ['leaderboard_rank'] },
  { label: 'One-Time Feats',            types: ['first_activity', 'first_mission', 'first_sweep', 'all_sports', 'points_in_day'] },
];

const TIER_ORDER = ['bronze', 'silver', 'gold'];
const TIER_COLOR: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
};

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 1000px; }
    .spinner-wrap { display:flex; justify-content:center; padding:80px; }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:26px; }
    .page-title { font-family:'Chakra Petch',sans-serif; font-size:26px; font-weight:700; color:#10203E; }
    .stats-pill {
      display:flex; align-items:center; gap:8px; background:#fff;
      border:1px solid #E3EAF5; border-radius:999px; padding:7px 16px;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#5c6881;
    }
    .stats-count { color:#10203E; }

    .category { margin-bottom:28px; }
    .category-label {
      font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700;
      letter-spacing:.18em; color:#8592ad; margin-bottom:12px;
    }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }

    .ach-card {
      background:#fff; border-radius:16px; border:1px solid #E3EAF5;
      padding:16px 16px 14px; position:relative; overflow:hidden;
      transition:box-shadow .15s;
    }
    .ach-card:hover { box-shadow:0 8px 20px -10px rgba(46,107,230,.2); }
    .ach-card.locked { opacity:.45; filter:grayscale(.7); }

    .ach-card-stripe { position:absolute; top:0; left:0; right:0; height:4px; border-radius:16px 16px 0 0; }
    .ach-card-tier {
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.18em; margin-top:8px; margin-bottom:6px;
    }
    .ach-card-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; line-height:1.2; margin-bottom:4px; }
    .ach-card-desc { font-size:11px; color:#8592ad; line-height:1.4; }
    .ach-card-date { font-size:10px; color:#b0bcd4; margin-top:8px; }
    .lock-icon { font-size:20px; margin-top:8px; display:block; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">🏅 ACHIEVEMENTS</div>
        <div class="stats-pill">
          <span class="stats-count">{{ unlockedCount }}</span>
          <span>/ {{ achievements.length }} unlocked</span>
        </div>
      </div>

      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      }

      @for (cat of categories; track cat.label) {
        @if (inCategory(cat).length > 0) {
          <div class="category">
            <div class="category-label">{{ cat.label.toUpperCase() }}</div>
            <div class="grid">
              @for (a of inCategory(cat); track a.id) {
                <div class="ach-card" [class.locked]="!a.unlocked">
                  <div class="ach-card-stripe" [style.background]="tierColor(a.tier)"></div>
                  <div class="ach-card-tier" [style.color]="tierColor(a.tier)">
                    {{ a.tier.toUpperCase() }}
                  </div>
                  @if (!a.unlocked) {
                    <span class="lock-icon">🔒</span>
                  }
                  <div class="ach-card-name">{{ a.name }}</div>
                  <div class="ach-card-desc">{{ a.description }}</div>
                  @if (a.unlocked && a.unlockedAt) {
                    <div class="ach-card-date">Unlocked {{ a.unlockedAt | date:'MMM d, y' }}</div>
                  } @else if (!a.unlocked) {
                    <div class="ach-card-date">+{{ a.xpReward }} XP on unlock</div>
                  }
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AchievementsComponent implements OnInit {
  achievements: AchievementStatus[] = [];
  loading = true;
  categories = CATEGORIES;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }

    this.api.getAchievements(userId).subscribe({
      next: (list) => { this.achievements = list; this.loading = false; },
      error: ()   => { this.loading = false; },
    });
  }

  get unlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  inCategory(cat: AchievementCategory): AchievementStatus[] {
    return this.achievements
      .filter(a => cat.types.includes(a.requirementType))
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  tierColor(tier: string): string {
    return TIER_COLOR[tier] ?? '#9fb2d6';
  }
}
```

- [ ] **Step 2: Register route in `app.routes.ts`**

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
];
```

- [ ] **Step 3: Add "BADGES" nav link in `app.component.ts`**

Find the nav items section in the template and add a third nav link after the Dashboard link:

```html
        <a routerLink="/achievements" routerLinkActive="active" class="nav-item">
          <span class="icon">🏅</span> BADGES
        </a>
```

The full nav items section should look like:

```html
        <nav class="nav-items">
          <a routerLink="/leaderboard" routerLinkActive="active" class="nav-item">
            <span class="icon">🏆</span> LEADERBOARD
          </a>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <span class="icon">📊</span> MY DASHBOARD
          </a>
          <a routerLink="/achievements" routerLinkActive="active" class="nav-item">
            <span class="icon">🏅</span> BADGES
          </a>
        </nav>
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Smoke-test the full flow manually**

1. Start backend: `dotnet run --project backend/Sport4You.Api --launch-profile http`
2. Start frontend: `cd frontend && npx ng serve`
3. Open `http://localhost:4200` — register or use existing account
4. Log a running activity → confirm overlay appears → achievement unlock overlay appears for "First Blood"
5. Navigate to `/achievements` — verify grid shows 33 achievements, First Blood unlocked
6. Dashboard → verify "Recent Achievements" widget shows First Blood

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/achievements/achievements.component.ts \
        frontend/src/app/app.routes.ts \
        frontend/src/app/app.component.ts
git commit -m "feat: add achievements page, route, and nav link"
```
