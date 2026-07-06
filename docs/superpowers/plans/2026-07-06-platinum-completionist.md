# Platinum Completionist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a meta-achievement, avatar, and cosmetic border that unlock together the moment a user earns all 33 existing achievements.

**Architecture:** One new nullable FK on `Achievement` (`GrantsBorderId`) lets `AchievementService` grant a border directly, in the same batch/transaction it already uses to grant achievements — no new `BorderService` evaluation pipeline. The avatar reuses the existing `achievement_earned` unlock mechanic verbatim (zero code changes to `AvatarService`). The trickiest part is a two-phase evaluation inside `AchievementService.EvaluateAchievementsAsync`, needed because the 33rd achievement and the Platinum achievement can unlock in the very same activity-log call.

**Tech Stack:** ASP.NET Core 8 / EF Core / SQLite (backend, no migrations — schema changes require deleting `sport4you.db`), Angular 17 standalone components (frontend), xUnit + `WebApplicationFactory` (backend tests).

## Global Constraints

- No changes to `POST /api/users` or `POST /api/activities` request/response shapes (assignment contracts).
- Border grants silently — no new unlock ceremony/splash for borders (explicit design decision).
- No generic achievement-linked border evaluation system — this is a targeted, one-off grant inside `AchievementService`, not a new `BorderService.EvaluateBordersAsync()` pipeline (explicit design decision, since exactly one border needs this today).
- Platinum does NOT get a Trophy Track "rail" — rails are reserved for 3-tier progression chains (bronze→silver→gold per metric). Platinum is a one-off, so it joins the existing `ONE_TIME_TYPES` list and renders in the "one-time feats" grid, same as "First Blood"/"Mission Possible".
- Achievement XP reward: 1000 (existing gold tier is uniformly 300 — Platinum is a deliberate step up).
- Achievement name: "Platinum Completionist". Description: "Unlock all 33 achievements."
- Art assets already exist at `frontend/src/assets/achievements/platinum-completionist.png` and `frontend/src/assets/avatars/platinum-sporty.png` (512×512, already in place) — no new art needed.
- SQLite uses `EnsureCreated()`, not migrations. Adding `Achievement.GrantsBorderId` changes the schema — **delete `backend/Sport4You.Api/sport4you.db` before running the app locally** after Task 1, or the app will fail with a missing-column error.

---

### Task 1: Data model + seeding

**Files:**
- Modify: `backend/Sport4You.Api/Models/Achievement.cs`
- Modify: `backend/Sport4You.Api/Data/DataSeeder.cs`
- Modify: `backend/Sport4You.Tests/AchievementServiceTests.cs:23-30` (fix hardcoded count assertion)
- Test: `backend/Sport4You.Tests/AchievementServiceTests.cs` (new test appended)

**Interfaces:**
- Produces: `Achievement.GrantsBorderId` (nullable `Guid`), a seeded `Border` row named "Platinum" with `Rarity = "platinum"`, a seeded `Achievement` row named "Platinum Completionist" with `RequirementType = "achievements_unlocked"`, `RequirementValue = 33`, `GrantsBorderId` pointing at the Platinum border, and a seeded `Avatar` row named "Platinum Sporty" with `UnlockType = "achievement_earned"` pointing at the Platinum achievement. Consumed by Task 2 (evaluation logic) and Task 3 (frontend rendering).

- [ ] **Step 1: Add `GrantsBorderId` to the `Achievement` model**

Edit `backend/Sport4You.Api/Models/Achievement.cs` — the full file becomes:

```csharp
namespace Sport4You.Api.Models;

public class Achievement
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = string.Empty;           // "bronze" | "silver" | "gold" | "platinum"
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string RequirementType { get; set; } = string.Empty;
    public double RequirementValue { get; set; }
    public string? Sport { get; set; }                          // null for cross-sport achievements
    public int XpReward { get; set; }
    public Guid? GrantsBorderId { get; set; }                   // nullable FK — only set on the Platinum achievement
}
```

- [ ] **Step 2: Write the failing seed-count test update**

Edit `backend/Sport4You.Tests/AchievementServiceTests.cs` — the existing test at lines 23-30 currently hardcodes 33; update it to 34 (this WILL fail until Step 4 seeds the new achievement):

```csharp
    [Fact]
    public async Task Seed_Creates34Achievements()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Achievements.CountAsync();
        Assert.Equal(34, count);
    }
```

Also append this new test at the end of the class, right before the closing brace (after the `CreateUserAsync` helper, i.e. as the last member before the final `}` — actually place it as a new `[Fact]` method alongside the others, anywhere after `Seed_Creates34Achievements`, e.g. immediately after it):

```csharp
    [Fact]
    public async Task Seed_PlatinumAchievement_GrantsBorderIdPointsAtPlatinumBorder()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var platinumAchievement = await db.Achievements.SingleAsync(a => a.Name == "Platinum Completionist");
        var platinumBorder = await db.Borders.SingleAsync(b => b.Name == "Platinum");

        Assert.Equal("platinum", platinumAchievement.Tier);
        Assert.Equal("achievements_unlocked", platinumAchievement.RequirementType);
        Assert.Equal(33, platinumAchievement.RequirementValue);
        Assert.Equal(platinumBorder.Id, platinumAchievement.GrantsBorderId);

        var platinumAvatar = await db.Avatars.SingleAsync(a => a.Name == "Platinum Sporty");
        Assert.Equal("achievement_earned", platinumAvatar.UnlockType);
        Assert.Equal(platinumAchievement.Id, platinumAvatar.UnlockAchievementId);
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter AchievementServiceTests`
Expected: FAIL — `Seed_Creates34Achievements` fails (33 != 34), `Seed_PlatinumAchievement_GrantsBorderIdPointsAtPlatinumBorder` fails (no such achievement/border yet).

- [ ] **Step 4: Reorder seeding and add the new rows**

Edit `backend/Sport4You.Api/Data/DataSeeder.cs`.

First, reorder `Seed()` so borders are seeded before achievements (borders have no dependencies; achievements will need to look up the Platinum border's ID by name):

```csharp
    public static void Seed(AppDbContext db, IScoringService scoring)
    {
        SeedUsers(db, scoring);
        SeedMissions(db);
        SeedBorders(db);
        SeedAchievements(db);
        SeedAvatars(db);
        SeedLootBoxAvatars(db);
        SeedLootBoxRewards(db);
    }
```

Next, add the Platinum border to `SeedBorders` — the method becomes:

```csharp
    private static void SeedBorders(AppDbContext db)
    {
        if (db.Borders.Any()) return;

        db.Borders.AddRange(
            B("Iron Ring",    "common",    "3px solid #9E9E9E",                                                                     "iron-ring"),
            B("Leaf Ring",    "common",    "3px solid #66BB6A",                                                                     "leaf-ring"),
            B("Sapphire Band","rare",      "3px double #2196F3",                                                                    "sapphire-band"),
            B("Aurora Band",  "rare",      "3px solid #9C27B0",                                                                     "aurora-band"),
            B("Gold Crown Ring","legendary","3px solid #FFD700",                                                                    "gold-crown-ring"),
            B("Inferno Halo", "legendary", "3px solid #FF6F00",                                                                     "inferno-halo"),
            B("Platinum",     "platinum",  "3px solid transparent; background: linear-gradient(#fff,#fff) padding-box, conic-gradient(from 0deg, #e8e8e8, #ffffff, #cfd9ff, #ffe8f7, #e8e8e8) border-box", "platinum-ring")
        );

        db.SaveChanges();
    }
```

(The `ImagePath` for "Platinum" resolves to `assets/borders/platinum-ring.png` via the existing `B()` helper's naming convention — no image file is required for this border specifically, since it's never surfaced through the loot-box reveal path that's the only current consumer of `Border.ImagePath`; it's equipped purely via `BorderCss`.)

Next, update `SeedAchievements` to look up the Platinum border's ID and add the Platinum achievement row. The method becomes:

```csharp
    private static void SeedAchievements(AppDbContext db)
    {
        if (db.Achievements.Any()) return;

        var borderByName = db.Borders.ToDictionary(b => b.Name, b => b.Id);

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
            A("gold",   "Centurion",        "Earn 10,000 points in a single day",                "points_in_day",  10000, null, 300),
            // Meta
            A("platinum", "Platinum Completionist", "Unlock all 33 achievements.", "achievements_unlocked", 33, null, 1000, borderByName.GetValueOrDefault("Platinum"))
        );

        db.SaveChanges();
    }
```

Update the `A()` helper to accept the new optional parameter — it becomes:

```csharp
    private static Achievement A(string tier, string name, string desc,
        string reqType, double reqVal, string? sport, int xp, Guid? grantsBorderId = null)
        => new() { Id = Guid.NewGuid(), Tier = tier, Name = name, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp,
                   GrantsBorderId = grantsBorderId };
```

Finally, add the Platinum avatar to `SeedAvatars` — add this as the last entry in the existing `db.Avatars.AddRange(...)` call (after `V("Veteran Sporty", ...)`, changing its trailing comma and closing the list with the new entry):

```csharp
            V("Veteran Sporty",      "Log 100 activities",                                 "activities_logged",  100, null),
            // Meta
            V("Platinum Sporty",     "Earn the Platinum Completionist achievement",        "achievement_earned", 0,   achByName.GetValueOrDefault("Platinum Completionist"))
```

(`SeedAvatars`'s existing `achByName` dictionary lookup — already built at the top of that method from `db.Achievements.ToDictionary(a => a.Name, a => a.Id)` — will find "Platinum Completionist" since `SeedAchievements` now runs before `SeedAvatars`, unchanged from today's order.)

- [ ] **Step 5: Delete the dev database and run tests**

Run: `rm -f backend/Sport4You.Api/sport4you.db`
Run: `cd backend && dotnet test --filter AchievementServiceTests`
Expected: PASS — both `Seed_Creates34Achievements` and `Seed_PlatinumAchievement_GrantsBorderIdPointsAtPlatinumBorder` pass. (The test suite uses an in-memory SQLite connection via `TestFactory`, not the dev `sport4you.db` file, so this delete is for your local `dotnet run` afterward, not for the tests themselves — but do it now so you don't forget.)

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Models/Achievement.cs backend/Sport4You.Api/Data/DataSeeder.cs backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: seed Platinum Completionist achievement, avatar, and border"
```

---

### Task 2: Two-phase evaluation logic in `AchievementService`

**Files:**
- Modify: `backend/Sport4You.Api/Services/AchievementService.cs`
- Test: `backend/Sport4You.Tests/AchievementServiceTests.cs` (new tests appended)

**Interfaces:**
- Consumes: `Achievement.GrantsBorderId` (Task 1). `_db.UserBorders` (existing `UserBorder` model — `UserId`, `BorderId`, `UnlockedAt`, `IsActive`, already used by `LootBoxService`).
- Produces: `EvaluateAchievementsAsync` now also grants Platinum + its border in the same batch when the 33rd achievement is reached; `ComputeProgress` recognizes `"achievements_unlocked"` for display. No signature changes — consumed by `ActivityService` and `AvatarService`'s existing pipeline exactly as today.

- [ ] **Step 1: Write the failing tests**

Append these tests to `backend/Sport4You.Tests/AchievementServiceTests.cs`, after the `Seed_PlatinumAchievement_GrantsBorderIdPointsAtPlatinumBorder` test added in Task 1:

```csharp
    [Fact]
    public async Task EvaluateAchievements_33rdAchievementInSameBatch_AlsoUnlocksPlatinumAndGrantsBorder()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Manually mark 32 of the 33 real achievements as already earned,
        // leaving exactly one ("First Blood") unearned. Logging one
        // qualifying activity below unlocks that 33rd achievement AND
        // should cascade Platinum in the same EvaluateAchievementsAsync call.
        var allRealAchievements = await db.Achievements
            .Where(a => a.Tier != "platinum" && a.Name != "First Blood")
            .ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var a in allRealAchievements)
            db.UserAchievements.Add(new UserAchievement { UserId = userId, AchievementId = a.Id, UnlockedAt = now });
        await db.SaveChangesAsync();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = now, Sport = "running", Distance = 5.0m, Points = 500,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var result = await svc.EvaluateAchievementsAsync(userId);

        Assert.Contains(result, a => a.Name == "First Blood");
        Assert.Contains(result, a => a.Name == "Platinum Completionist");

        var platinumBorderId = await db.Borders.Where(b => b.Name == "Platinum").Select(b => b.Id).SingleAsync();
        var grantedBorder = await db.UserBorders.SingleOrDefaultAsync(ub => ub.UserId == userId && ub.BorderId == platinumBorderId);
        Assert.NotNull(grantedBorder);
    }

    [Fact]
    public async Task EvaluateAchievements_Only32Earned_DoesNotUnlockPlatinum()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Mark 31 real achievements earned, leaving "First Blood" and
        // "Mission Possible" unearned. Logging one plain activity unlocks
        // "First Blood" (first_activity) but NOT "Mission Possible" (which
        // needs a completed daily mission, unaffected by a bare activity
        // log) — landing at exactly 32/33, one short of Platinum.
        // "Mission Possible" is chosen deliberately over any leaderboard-
        // rank-based achievement: this test class shares one DB fixture
        // across all tests (IClassFixture<TestFactory>), so a rank-based
        // achievement could unlock unpredictably depending on other users'
        // points from other tests. Mission completion has no such risk.
        var allRealAchievements = await db.Achievements
            .Where(a => a.Tier != "platinum" && a.Name != "First Blood" && a.Name != "Mission Possible")
            .ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var a in allRealAchievements)
            db.UserAchievements.Add(new UserAchievement { UserId = userId, AchievementId = a.Id, UnlockedAt = now });
        await db.SaveChangesAsync();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = now, Sport = "running", Distance = 5.0m, Points = 500,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var result = await svc.EvaluateAchievementsAsync(userId);

        Assert.Contains(result, a => a.Name == "First Blood");
        Assert.DoesNotContain(result, a => a.Name == "Platinum Completionist");
    }

    [Fact]
    public async Task EvaluateAchievements_Already33EarnedFromBefore_UnlocksPlatinumOnNextActivity()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // All 33 real achievements already earned (simulating a user who
        // completed the set before this feature existed) — the very next
        // activity log (which triggers evaluation) should unlock Platinum
        // immediately, with no new real achievement needed.
        var allRealAchievements = await db.Achievements.Where(a => a.Tier != "platinum").ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var a in allRealAchievements)
            db.UserAchievements.Add(new UserAchievement { UserId = userId, AchievementId = a.Id, UnlockedAt = now });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var result = await svc.EvaluateAchievementsAsync(userId);

        Assert.Contains(result, a => a.Name == "Platinum Completionist");
    }

    [Fact]
    public async Task GetUserAchievements_PlatinumProgress_ExcludesItselfFromCount()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var someAchievements = await db.Achievements.Where(a => a.Tier != "platinum").Take(5).ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var a in someAchievements)
            db.UserAchievements.Add(new UserAchievement { UserId = userId, AchievementId = a.Id, UnlockedAt = now });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var list = await svc.GetUserAchievementsAsync(userId);

        var platinum = list.Single(a => a.Name == "Platinum Completionist");
        Assert.Equal(5, platinum.Progress);
        Assert.Equal(33, platinum.RequirementValue);
        Assert.False(platinum.Unlocked);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter AchievementServiceTests`
Expected: FAIL — `achievements_unlocked` isn't a known requirement type yet, so Platinum never unlocks and its progress computes to 0 in all four new tests.

- [ ] **Step 3: Implement the two-phase evaluation**

Edit `backend/Sport4You.Api/Services/AchievementService.cs`.

Add `"achievements_unlocked"` to `KnownRequirementTypes` (line ~129-134):

```csharp
    private static readonly HashSet<string> KnownRequirementTypes =
    [
        "total_km", "total_minutes", "total_steps", "streak_days",
        "level_reached", "leaderboard_rank", "first_activity",
        "first_mission", "first_sweep", "all_sports", "points_in_day",
        "achievements_unlocked",
    ];
```

Add a new field to `UserAggregates` (the `sealed record` at line ~116-127) — it becomes:

```csharp
    private sealed record UserAggregates(
        Dictionary<string, double> KmBySport,
        Dictionary<string, int> MinBySport,
        int TotalSteps,
        int DistinctSports,
        int MaxPointsInDay,
        int Streak,
        int Level,
        int Rank,
        bool HasMission,
        bool HasSweep,
        int ActivityCount,
        int AchievementsUnlockedCount);
```

In `ComputeAggregatesAsync`, add the query for the new field and pass it into the returned record. The method's final block changes from:

```csharp
        return new UserAggregates(
            totalKmBySport, totalMinBySport, totalSteps, distinctSports,
            maxPointsInDay, streak, level, rank, hasMission, hasSweep,
            allActivities.Count);
```

to:

```csharp
        var nonPlatinumAchievementIds = await _db.Achievements
            .Where(a => a.Tier != "platinum")
            .Select(a => a.Id)
            .ToListAsync();
        var achievementsUnlockedCount = await _db.UserAchievements
            .CountAsync(ua => ua.UserId == userId && nonPlatinumAchievementIds.Contains(ua.AchievementId));

        return new UserAggregates(
            totalKmBySport, totalMinBySport, totalSteps, distinctSports,
            maxPointsInDay, streak, level, rank, hasMission, hasSweep,
            allActivities.Count, achievementsUnlockedCount);
```

Add a case to `ComputeProgress` (the `switch` at line ~185-203) — insert this arm anywhere in the switch (e.g. right after `"points_in_day"`):

```csharp
            "points_in_day"    => agg.MaxPointsInDay,
            "achievements_unlocked" => agg.AchievementsUnlockedCount,
```

Now rewrite `EvaluateAchievementsAsync` (lines ~49-112) to skip `"achievements_unlocked"` in the main loop and handle it in a dedicated second phase afterward, plus grant any `GrantsBorderId` alongside the achievements it unlocks. The full method becomes:

```csharp
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

        var agg = await ComputeAggregatesAsync(userId);

        // Evaluate + batch-save. "achievements_unlocked" (Platinum) is
        // intentionally skipped here — its requirement depends on how many
        // OTHER achievements unlock in this same pass, which isn't known
        // until after this loop completes (see the second phase below).
        var toUnlock = new List<Achievement>();
        foreach (var a in unearned)
        {
            if (a.RequirementType == "achievements_unlocked") continue;
            if (!KnownRequirementTypes.Contains(a.RequirementType)) continue;
            var progress = ComputeProgress(a, agg);
            var meets = a.RequirementType == "leaderboard_rank"
                ? progress <= a.RequirementValue
                : progress >= a.RequirementValue;
            if (meets) toUnlock.Add(a);
        }

        // Second phase: check Platinum against (already-earned count) +
        // (newly-unlocked-this-batch count), so a user whose 33rd real
        // achievement unlocks in this exact call also cascades Platinum
        // in the same batch, not on a subsequent activity log.
        var platinum = unearned.FirstOrDefault(a => a.RequirementType == "achievements_unlocked");
        if (platinum != null)
        {
            var willHaveCount = earnedIds.Count + toUnlock.Count;
            if (willHaveCount >= platinum.RequirementValue) toUnlock.Add(platinum);
        }

        if (toUnlock.Count == 0) return [];

        var now = DateTime.UtcNow;
        var totalXpToAward = 0;
        var result = new List<UnlockedAchievementDto>();

        // Batch XP update inline rather than calling AwardGenericXpAsync per achievement —
        // one SaveChangesAsync flush for all unlocked rows instead of N separate calls.
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

            if (a.GrantsBorderId.HasValue)
            {
                _db.UserBorders.Add(new UserBorder
                {
                    UserId = userId, BorderId = a.GrantsBorderId.Value, UnlockedAt = now, IsActive = false,
                });
            }
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter AchievementServiceTests`
Expected: PASS — all 8 tests in the file passing (4 pre-existing + 4 new from this task, plus the 2 from Task 1).

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && dotnet test`
Expected: PASS — no regressions elsewhere (in particular, `AvatarServiceTests` should still pass unchanged, since the avatar cascade needs zero code changes).

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/AchievementService.cs backend/Sport4You.Tests/AchievementServiceTests.cs
git commit -m "feat: two-phase achievement evaluation unlocks Platinum + grants its border in one batch"
```

---

### Task 3: Frontend Trophy Track wiring + live verification

**Files:**
- Modify: `frontend/src/app/achievements/achievements.component.ts`

**Interfaces:**
- Consumes: the `"platinum"` tier string and `"achievements_unlocked"` requirement type, already flowing through the existing `AchievementStatusDto` fields (`Tier`, `RequirementType`, `Progress`, `RequirementValue`) — no new DTO fields needed.

- [ ] **Step 1: Add `"achievements_unlocked"` to `ONE_TIME_TYPES`**

Edit `frontend/src/app/achievements/achievements.component.ts` line 65 — it becomes:

```typescript
const ONE_TIME_TYPES = ['first_activity', 'first_mission', 'first_sweep', 'all_sports', 'points_in_day', 'achievements_unlocked'];
```

- [ ] **Step 2: Add a `"platinum"` entry to `TIER_META`**

Edit the `TIER_META` record (lines 77-96) — add a `platinum` key after `gold`:

```typescript
const TIER_META: Record<string, TierMeta> = {
  bronze: {
    frame: 'linear-gradient(160deg,#F5D3A3,#CD7F32 55%,#8A4F16)',
    frameShadow: '0 18px 30px -20px rgba(205,127,50,.6)',
    labelColor: '#B5701E', rarity: 'COMMON',
    badgeColor: '#fff', badgeBg: 'rgba(138,79,22,.9)',
  },
  silver: {
    frame: 'linear-gradient(160deg,#F2F5FA,#C6CFDE 55%,#93A1B7)',
    frameShadow: '0 18px 30px -20px rgba(120,140,170,.55)',
    labelColor: '#7E8A9C', rarity: 'RARE',
    badgeColor: '#fff', badgeBg: 'rgba(90,105,130,.9)',
  },
  gold: {
    frame: 'linear-gradient(160deg,#FDE9A7,#F5B300 50%,#B57C00)',
    frameShadow: '0 18px 30px -18px rgba(245,179,0,.5)',
    labelColor: '#C58A00', rarity: 'LEGENDARY',
    badgeColor: '#7a5200', badgeBg: 'rgba(255,255,255,.85)',
  },
  platinum: {
    frame: 'linear-gradient(160deg,#ffffff,#cfd9ff 45%,#e8e8e8 70%,#b8c4ff)',
    frameShadow: '0 18px 30px -18px rgba(150,170,255,.6)',
    labelColor: '#5b6fd6', rarity: 'MYTHIC',
    badgeColor: '#3a4a9e', badgeBg: 'rgba(255,255,255,.9)',
  },
};
```

(This card does not opt into the gold-only "tease when locked" treatment — `AchievementCardComponent`'s `frame`/`frameShadow`/`showHolo`/`lockColor`/`rarityColor`/`rarityBg` getters all special-case `this.a.tier === 'gold'` only; Platinum falls back to the standard muted `LOCKED_FRAME` when locked, same as bronze/silver. This is a deliberate scope decision — no new visual language beyond adding the tier's own metadata.)

- [ ] **Step 3: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: No errors.

- [ ] **Step 4: Live verification via Playwright**

Delete the dev database if you haven't already since Task 1 (`rm -f backend/Sport4You.Api/sport4you.db`), then start both servers:

```bash
cd backend/Sport4You.Api && dotnet run &
cd frontend && ng serve &
```

Use Playwright (or the project's established Playwright verification approach) to:
1. Register a new user via `POST /api/users`.
2. Directly manipulate the database (or use a small throwaway script hitting the same DB the running app uses) to mark all 33 non-Platinum achievements as already earned for that user via `UserAchievements` rows, mirroring the pattern in `EvaluateAchievements_Already33EarnedFromBefore_UnlocksPlatinumOnNextActivity` — this is far faster than actually grinding out 33 real achievements through the UI.
3. Log one activity via `POST /api/activities` for that user (any qualifying activity, e.g. a running activity) to trigger evaluation.
4. Confirm the API response's `achievementsUnlocked` list includes "Platinum Completionist".
5. Navigate to `/achievements` as that user (`localStorage.userId` set to their ID) and confirm: the "Latest Unlock" spotlight banner shows "Platinum Completionist" with the platinum frame styling; the one-time feats grid also shows it as unlocked.
6. Navigate to `/profile/{userId}`, open the Borders tab, and confirm a "Platinum" border now appears (unlocked but not yet equipped).
7. Screenshot the achievements page spotlight and the borders tab as evidence.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/achievements/achievements.component.ts
git commit -m "feat: render Platinum Completionist in Trophy Track's one-time feats grid"
```

---

## Post-Plan Verification

After all tasks are complete, run the full backend suite once more to confirm no cross-task regressions:

```bash
cd backend && dotnet test
```

Expected: all tests passing, including the 6 new tests added across Tasks 1-2 (2 in Task 1, 4 in Task 2).
