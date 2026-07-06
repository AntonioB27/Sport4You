# Coins + Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft currency ("Coins") earned from logging activities, spendable in a new Shop on an XP booster consumable, two tiers of purchasable loot boxes, and six brand-new shop-exclusive avatars.

**Architecture:** Two new scalar fields on the existing `UserXp` row (`Coins`, `BoostedActivitiesRemaining`) carry all currency/booster state — no new tables. A new `IShopService`/`ShopService` owns coin earning and all three purchase flows, following the same "service owns its own `AppDbContext` reads/writes directly" pattern already used by `LootBoxService`/`AvatarService`. The XP booster multiplier is applied inline inside `XpService.AwardActivityXpAsync`, in the same spot the existing prestige multiplier already lives, because that method already holds the loaded `UserXp` row. Loot box rarity odds become reason-dependent (`shop_normal` vs `shop_special`) via one `if` inside the existing `LootBoxService.OpenBoxAsync` roll — the reward pool, open modal, and duplicate-to-XP conversion are all reused verbatim.

**Tech Stack:** ASP.NET Core 8 / EF Core / SQLite (backend, no migrations — schema changes require deleting `sport4you.db`), Angular 17 standalone components (frontend), xUnit + `WebApplicationFactory` (backend tests). No Playwright/e2e framework is configured in this repo — frontend tasks are verified via `ng build` (type-check) plus a manual check in the browser via `ng serve`.

## Global Constraints

- No changes to `POST /api/users` or `POST /api/activities` request/response *shapes* (assignment contracts) — `POST /api/activities`'s response gains one additive field (`boostApplied`), which does not change the existing required shape.
- Coins earned: `points / 10` (integer division/floor), applied to every point-earning log — both `POST /api/activities` and `POST /api/users/{id}/steps`.
- XP Booster: +50% XP (`×1.5`, floored) on the next 3 logged activities, costs 400 coins. Purchasing again while one is active is additive (extends the remaining-activities counter, does not stack the multiplier).
- Booster multiplier applies only where the existing prestige multiplier already applies (`XpService.AwardActivityXpAsync`, i.e. the six main sports) — NOT to daily-steps XP or loot-box-duplicate XP, both of which go through `AwardGenericXpAsync` and already skip the prestige multiplier today. This keeps booster scope identical to prestige scope.
- Loot boxes: Normal tier costs 500 coins at the existing 60/30/10 common/rare/legendary odds; Special tier costs 1000 coins at 30/45/25 odds. Both reuse the entire existing reward pool, open modal, and duplicate-to-XP conversion unchanged.
- Six shop-exclusive avatars, `UnlockType = "shop"`, never earnable via loot box or achievement: Common 300 coins (Sleuth Sporty, Scavenger Sporty), Rare 800 coins (Bladewalker Sporty, Ringbearer Sporty), Legendary 1500 coins (Master Assassin Sporty, Dark Lord Sporty). Exact names/descriptions/flavor text and AI-image-gen prompts are in the design spec: `docs/superpowers/specs/2026-07-06-coins-shop-design.md`.
- No purchasing of existing loot-box-exclusive or achievement-exclusive avatars/borders directly with coins.
- No real-money purchases anywhere — coins are earned in-app only.
- SQLite uses `EnsureCreated()`, not migrations. Task 1 changes the schema (`UserXp` and `Avatar` gain new columns) — **delete `backend/Sport4You.Api/sport4you.db` before running the app locally** after Task 1, or the app will fail with a missing-column error.
- Art assets for the six new shop avatars do NOT exist yet. This plan seeds `Avatar` rows pointing at `assets/avatars/shop/{slug}.png` paths that won't resolve to real images until someone runs the AI-image-gen prompts from the design spec and drops the resulting 512×512 PNGs (via `sips -Z 512` downscale, per the project's existing asset workflow) into `frontend/src/assets/avatars/shop/`. This is a manual, out-of-band step — no task in this plan generates images.

---

### Task 1: Data model + seeding

**Files:**
- Modify: `backend/Sport4You.Api/Models/UserXp.cs`
- Modify: `backend/Sport4You.Api/Models/Avatar.cs`
- Modify: `backend/Sport4You.Api/Data/DataSeeder.cs`
- Modify: `backend/Sport4You.Tests/AvatarServiceTests.cs:23-30,32-43,240-254` (fix hardcoded 34-avatar-count assertions)
- Test: `backend/Sport4You.Tests/AvatarServiceTests.cs` (new test appended)

**Interfaces:**
- Produces: `UserXp.Coins` (`int`), `UserXp.BoostedActivitiesRemaining` (`int`); `Avatar.ShopRarity` (`string?`), `Avatar.ShopPrice` (`int?`); six seeded `Avatar` rows with `UnlockType = "shop"`. Consumed by Task 2 (XP booster), Task 3 (coin earning + booster purchase), Task 5 (loot box purchase), Task 6 (avatar purchase), Task 7 (catalog).

- [ ] **Step 1: Add `Coins` and `BoostedActivitiesRemaining` to `UserXp`**

Edit `backend/Sport4You.Api/Models/UserXp.cs` — full file becomes:

```csharp
namespace Sport4You.Api.Models;

public class UserXp
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int TotalXp { get; set; }
    public int PrestigeLevel { get; set; }
    public int Coins { get; set; }
    public int BoostedActivitiesRemaining { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

- [ ] **Step 2: Add `ShopRarity` and `ShopPrice` to `Avatar`**

Edit `backend/Sport4You.Api/Models/Avatar.cs` — full file becomes:

```csharp
namespace Sport4You.Api.Models;

public class Avatar
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string UnlockType { get; set; } = string.Empty;   // "default"|"level_reached"|"achievement_earned"|"streak_days"|"activities_logged"|"loot_box"|"shop"
    public double UnlockValue { get; set; }                  // 0 for "default", "achievement_earned", and "shop"
    public Guid? UnlockAchievementId { get; set; }           // nullable FK — only set when UnlockType == "achievement_earned"
    public string ImagePath { get; set; } = string.Empty;    // e.g. "assets/avatars/starter-sporty.png"
    public string? ShopRarity { get; set; }                  // "common" | "rare" | "legendary" — shop avatars only
    public int? ShopPrice { get; set; }                      // coin price — shop avatars only
}
```

- [ ] **Step 3: Write the failing seed-count test updates**

Edit `backend/Sport4You.Tests/AvatarServiceTests.cs`. Three existing tests hardcode `34` (the current avatar count); update all three to `40` (34 existing + 6 new shop avatars) and rename them to match:

Replace the test at lines 23-30:
```csharp
    [Fact]
    public async Task Seed_Creates40Avatars()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // 21 regular avatars + 13 loot-box avatars + 6 shop avatars = 40 total
        Assert.Equal(40, await db.Avatars.CountAsync());
    }
```

Replace the test at lines 32-43:
```csharp
    [Fact]
    public async Task GetUserAvatars_ReturnsAll40WithLockedState()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        var list = await svc.GetUserAvatarsAsync(userId);
        // 40 total avatars; default is unlocked at registration, rest are locked
        Assert.Equal(40, list.Count);
        Assert.Equal(1, list.Count(a => a.Unlocked));
        Assert.True(list.Single(a => a.Unlocked).IsActive);
    }
```

Replace the test at lines 240-254 (`GetAvatarsEndpoint_Returns34Items`):
```csharp
    [Fact]
    public async Task GetAvatarsEndpoint_Returns40Items()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "GetAv", lastName = suffix });
        var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        var userId = regBody!["userId"];

        var r = await _client.GetAsync($"/api/users/{userId}/avatars");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(System.Text.Json.JsonValueKind.Array, body.ValueKind);
        Assert.Equal(40, body.GetArrayLength());
    }
```

Also append this new test at the end of the class, right before the closing brace (after the `CreateUserAsync` helper):

```csharp
    [Fact]
    public async Task Seed_ShopAvatars_HaveCorrectPricingByRarity()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var shopAvatars = await db.Avatars.Where(a => a.UnlockType == "shop").ToListAsync();
        Assert.Equal(6, shopAvatars.Count);
        Assert.All(shopAvatars, a => Assert.NotNull(a.ShopRarity));
        Assert.All(shopAvatars, a => Assert.NotNull(a.ShopPrice));
        Assert.Equal(2, shopAvatars.Count(a => a.ShopRarity == "common"));
        Assert.Equal(2, shopAvatars.Count(a => a.ShopRarity == "rare"));
        Assert.Equal(2, shopAvatars.Count(a => a.ShopRarity == "legendary"));
        Assert.All(shopAvatars.Where(a => a.ShopRarity == "common"), a => Assert.Equal(300, a.ShopPrice));
        Assert.All(shopAvatars.Where(a => a.ShopRarity == "rare"), a => Assert.Equal(800, a.ShopPrice));
        Assert.All(shopAvatars.Where(a => a.ShopRarity == "legendary"), a => Assert.Equal(1500, a.ShopPrice));
    }
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter AvatarServiceTests`
Expected: FAIL — the three renamed tests fail (34 avatars exist, not 40), `Seed_ShopAvatars_HaveCorrectPricingByRarity` fails (0 shop avatars exist).

- [ ] **Step 5: Seed the six shop avatars**

Edit `backend/Sport4You.Api/Data/DataSeeder.cs`. Add a call to a new `SeedShopAvatars` method at the end of `Seed()`:

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
        SeedShopAvatars(db);
    }
```

Add the new method and its helper immediately after `SeedLootBoxAvatars`/before `SeedLootBoxRewards` (or anywhere else at class scope — exact placement in the file doesn't matter, but keep it near the other avatar-seeding methods for readability):

```csharp
    private static void SeedShopAvatars(AppDbContext db)
    {
        if (db.Avatars.Any(a => a.UnlockType == "shop")) return;

        db.Avatars.AddRange(
            Shop("Sleuth Sporty",         "Elementary, my dear hydration.",              "common",    300,  "sleuth-sporty"),
            Shop("Scavenger Sporty",      "Fortune and glory... and electrolytes.",      "common",    300,  "scavenger-sporty"),
            Shop("Bladewalker Sporty",    "May the pace be with you.",                   "rare",      800,  "bladewalker-sporty"),
            Shop("Ringbearer Sporty",     "One does not simply skip leg day.",           "rare",      800,  "ringbearer-sporty"),
            Shop("Master Assassin Sporty","Nothing is true, everything is cardio.",      "legendary", 1500, "master-assassin-sporty"),
            Shop("Dark Lord Sporty",      "I find your lack of hydration disturbing.",   "legendary", 1500, "dark-lord-sporty")
        );

        db.SaveChanges();
    }

    private static Avatar Shop(string name, string desc, string rarity, int price, string slug)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = desc,
            UnlockType = "shop",
            UnlockValue = 0,
            ImagePath = $"assets/avatars/shop/{slug}.png",
            ShopRarity = rarity,
            ShopPrice = price,
        };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter AvatarServiceTests`
Expected: PASS (all avatar tests, including the new pricing test).

- [ ] **Step 7: Delete the local dev database and run the full backend suite**

Run: `rm -f backend/Sport4You.Api/sport4you.db && cd backend && dotnet test`
Expected: PASS (all tests, including the ones just changed). This confirms the schema change didn't silently break any other seeded-data assumption elsewhere in the suite.

- [ ] **Step 8: Commit**

```bash
git add backend/Sport4You.Api/Models/UserXp.cs backend/Sport4You.Api/Models/Avatar.cs backend/Sport4You.Api/Data/DataSeeder.cs backend/Sport4You.Tests/AvatarServiceTests.cs
git commit -m "feat: add Coins/booster fields and seed 6 shop-exclusive avatars"
```

---

### Task 2: XP Booster core mechanic

**Files:**
- Modify: `backend/Sport4You.Api/Services/IXpService.cs`
- Modify: `backend/Sport4You.Api/Services/XpService.cs`
- Test: `backend/Sport4You.Tests/XpServiceTests.cs` (new tests appended)

**Interfaces:**
- Consumes: `UserXp.BoostedActivitiesRemaining` (Task 1).
- Produces: `XpAwardResult(int XpEarned, bool BoostApplied)` record; `IXpService.AwardActivityXpAsync` now returns `Task<XpAwardResult>` instead of `Task<int>`. Consumed by Task 4 (`ActivityService` call-site update + `BoostApplied` propagation to the API response).

- [ ] **Step 1: Write the failing tests**

Append to `backend/Sport4You.Tests/XpServiceTests.cs`, inside the existing `XpServiceIntegrationTests` class (after `AwardGenericXp_UpdatesUserXpAndCreatesTransaction`, before the closing brace):

```csharp
    [Fact]
    public async Task AwardActivityXp_NoBoost_ReturnsBoostAppliedFalse()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        using var scope = _factory.Services.CreateScope();
        var xpSvc = scope.ServiceProvider.GetRequiredService<IXpService>();

        var result = await xpSvc.AwardActivityXpAsync(userId, Guid.NewGuid(), "running", 5.0m, null, null);

        Assert.Equal(100, result.XpEarned); // floor(5 * 20) = 100, no boost
        Assert.False(result.BoostApplied);
    }

    [Fact]
    public async Task AwardActivityXp_WithBoost_AppliesMultiplierAndDecrementsCounter()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Sport4You.Api.Data.AppDbContext>();
        db.UserXp.Add(new Sport4You.Api.Models.UserXp
        {
            UserId = userId, TotalXp = 0, PrestigeLevel = 0,
            Coins = 0, BoostedActivitiesRemaining = 3, UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var xpSvc = scope.ServiceProvider.GetRequiredService<IXpService>();
        var result = await xpSvc.AwardActivityXpAsync(userId, Guid.NewGuid(), "running", 5.0m, null, null);

        Assert.Equal(150, result.XpEarned); // floor(100 * 1.5) = 150
        Assert.True(result.BoostApplied);

        var row = await db.UserXp.FindAsync(userId);
        Assert.Equal(2, row!.BoostedActivitiesRemaining);
    }

    [Fact]
    public async Task AwardActivityXp_BoostExhausted_StopsApplyingAfterThirdActivity()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Sport4You.Api.Data.AppDbContext>();
        db.UserXp.Add(new Sport4You.Api.Models.UserXp
        {
            UserId = userId, TotalXp = 0, PrestigeLevel = 0,
            Coins = 0, BoostedActivitiesRemaining = 1, UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var xpSvc = scope.ServiceProvider.GetRequiredService<IXpService>();

        var first = await xpSvc.AwardActivityXpAsync(userId, Guid.NewGuid(), "running", 5.0m, null, null);
        Assert.True(first.BoostApplied);
        Assert.Equal(150, first.XpEarned);

        var second = await xpSvc.AwardActivityXpAsync(userId, Guid.NewGuid(), "running", 5.0m, null, null);
        Assert.False(second.BoostApplied);
        Assert.Equal(100, second.XpEarned);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter XpServiceIntegrationTests`
Expected: FAIL to compile — `AwardActivityXpAsync` currently returns `Task<int>`, so `result.XpEarned`/`result.BoostApplied` don't exist yet.

- [ ] **Step 3: Add the `XpAwardResult` record and update the interface**

Edit `backend/Sport4You.Api/Services/IXpService.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record LevelInfo(int Level, string Title, int XpInLevel, int XpForNextLevel, int XpPercent);
public record XpSummary(int TotalXp, LevelInfo LevelInfo);
public record XpAwardResult(int XpEarned, bool BoostApplied);
public record MissionEvaluationResult(List<CompletedMissionDto> NewlyCompleted, int XpAwarded);
public record PrestigeResult(bool Success, string? Error, XpSummary? Summary);
public record DailyMissionStatus(
    Guid Id, string Tier, string Description, int XpReward,
    bool Completed, double Progress, double ProgressMax);

public interface IXpService
{
    // Pure (no DB) — fully unit testable
    int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps);
    LevelInfo GetLevelInfo(int totalXp);

    // DB operations — added in Task 3
    Task<XpAwardResult> AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps);
    Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date);
    Task<XpSummary> GetXpSummaryAsync(Guid userId);
    Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date);
    Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId);
    Task<int> GetPrestigeLevelAsync(Guid userId);
    Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync();
    Task<PrestigeResult> PrestigeAsync(Guid userId);
}
```

- [ ] **Step 4: Apply the booster multiplier in `AwardActivityXpAsync`**

Edit `backend/Sport4You.Api/Services/XpService.cs` — replace the `AwardActivityXpAsync` method (lines 67-100) with:

```csharp
    public async Task<XpAwardResult> AwardActivityXpAsync(
        Guid userId, Guid activityId, string sport,
        decimal? distance, string? duration, int? steps)
    {
        var baseXp = CalculateActivityXp(sport, distance, duration, steps);
        var now = DateTime.UtcNow;

        var row = await _db.UserXp.FindAsync(userId);
        var previousXp = row?.TotalXp ?? 0;
        var prestigeLevel = row?.PrestigeLevel ?? 0;
        var xpEarned = (int)(baseXp * (1 + 0.05 * prestigeLevel));

        var boostApplied = (row?.BoostedActivitiesRemaining ?? 0) > 0;
        if (boostApplied)
            xpEarned = (int)(xpEarned * 1.5);

        var levelBefore = GetLevelInfo(previousXp).Level;

        if (row == null)
        {
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xpEarned, UpdatedAt = now });
        }
        else
        {
            row.TotalXp += xpEarned;
            row.UpdatedAt = now;
            if (boostApplied)
                row.BoostedActivitiesRemaining--;
        }

        _db.XpTransactions.Add(new XpTransaction
        {
            Id = Guid.NewGuid(), UserId = userId, Source = "activity",
            SourceId = activityId, XpEarned = xpEarned, CreatedAt = now,
        });

        await _db.SaveChangesAsync();

        var levelAfter = GetLevelInfo(previousXp + xpEarned).Level;
        await AwardLevelUpBoxesAsync(userId, levelBefore, levelAfter);

        return new XpAwardResult(xpEarned, boostApplied);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter XpService`
Expected: PASS — this includes the pre-existing `XpServiceTests`/`XpServiceIntegrationTests` (confirms `LogActivity_ReturnsXpEarned` still returns 100 for a fresh user with no boost) plus the three new tests. Note this will currently fail to build the rest of the solution (Step 6 fixes that).

- [ ] **Step 6: Fix the now-broken call site so the solution builds**

`ActivityService.LogActivityAsync` still expects an `int` back from `AwardActivityXpAsync`. Edit `backend/Sport4You.Api/Services/ActivityService.cs` line 88-89, changing:

```csharp
        var xpEarned = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);
```

to:

```csharp
        var xpAward = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);
        var xpEarned = xpAward.XpEarned;
```

(This keeps the rest of `LogActivityAsync` compiling unchanged for now — `xpAward.BoostApplied` gets wired into the API response in Task 4.)

- [ ] **Step 7: Run the full backend suite to verify nothing else broke**

Run: `cd backend && dotnet test`
Expected: PASS (all tests).

- [ ] **Step 8: Commit**

```bash
git add backend/Sport4You.Api/Services/IXpService.cs backend/Sport4You.Api/Services/XpService.cs backend/Sport4You.Api/Services/ActivityService.cs backend/Sport4You.Tests/XpServiceTests.cs
git commit -m "feat: apply XP booster multiplier in AwardActivityXpAsync"
```

---

### Task 3: ShopService — coin earning + XP Booster purchase

**Files:**
- Create: `backend/Sport4You.Api/DTOs/ShopDtos.cs`
- Create: `backend/Sport4You.Api/Services/IShopService.cs`
- Create: `backend/Sport4You.Api/Services/ShopService.cs`
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs` (inject `IShopService`, award coins)
- Modify: `backend/Sport4You.Api/Program.cs` (DI registration)
- Test: `backend/Sport4You.Tests/ShopServiceTests.cs` (new file)

**Interfaces:**
- Consumes: `UserXp.Coins`/`BoostedActivitiesRemaining` (Task 1).
- Produces: `IShopService` with `AddCoinsAsync(Guid userId, int coinsEarned)`, `GetBalanceAsync(Guid userId) : Task<(int Coins, int BoostedActivitiesRemaining)>`, `PurchaseBoosterAsync(Guid userId) : Task<BoosterPurchaseResult>`. `BoosterPurchaseResult(bool Success, string? Error, int Coins, int BoostedActivitiesRemaining)`. Consumed by Task 4 (ActivityService already updated here for coin earning), Task 7 (catalog uses `GetBalanceAsync`), Task 8 (dashboard uses `GetBalanceAsync`), and the `ShopController` built in Task 4.

- [ ] **Step 1: Create the Shop DTOs**

Create `backend/Sport4You.Api/DTOs/ShopDtos.cs`:

```csharp
namespace Sport4You.Api.DTOs;

public record ShopBoosterDto(int Price, int BoostedActivities, double Multiplier);
public record ShopLootBoxDto(string Tier, int Price, int CommonPct, int RarePct, int LegendaryPct);
public record ShopAvatarDto(Guid Id, string Name, string Description, string ImagePath, string Rarity, int Price, bool Owned);

public record ShopCatalogDto(
    int Coins,
    int BoostedActivitiesRemaining,
    ShopBoosterDto Booster,
    List<ShopLootBoxDto> LootBoxes,
    List<ShopAvatarDto> Avatars);

public record BoosterPurchaseResult(bool Success, string? Error, int Coins, int BoostedActivitiesRemaining);
public record LootBoxPurchaseResult(bool Success, string? Error, int Coins, int PendingBoxes);
public record AvatarPurchaseResult(bool Success, string? Error, int Coins);

public record PurchaseLootBoxRequest(string Tier);
public record PurchaseAvatarRequest(Guid AvatarId);
```

- [ ] **Step 2: Write the failing tests**

Create `backend/Sport4You.Tests/ShopServiceTests.cs`:

```csharp
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class ShopServiceTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    private readonly HttpClient _client;

    public ShopServiceTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> CreateUserAsync()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Shop", lastName = suffix });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogActivity_AwardsCoinsAtOneTenthOfPoints()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        // 5km run: floor(5 * 100) = 500 points -> 50 coins
        await _client.PostAsJsonAsync("/api/activities", new
        {
            userId = userIdStr, datetime = "2026-07-01T10:00:00Z", sport = "running", distance = 5.0,
        });

        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
        var (coins, _) = await shop.GetBalanceAsync(userId);
        Assert.Equal(50, coins);
    }

    [Fact]
    public async Task LogSteps_AwardsCoinsAtOneTenthOfPoints()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        // 1000 steps: floor(1000/100) = 10 points -> 1 coin (integer division floors to 1)
        await _client.PostAsJsonAsync($"/api/users/{userIdStr}/steps", new { steps = 1000 });

        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
        var (coins, _) = await shop.GetBalanceAsync(userId);
        Assert.Equal(1, coins);
    }

    [Fact]
    public async Task PurchaseBooster_InsufficientCoins_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var result = await shop.PurchaseBoosterAsync(userId);

        Assert.False(result.Success);
        Assert.Equal("Insufficient coins", result.Error);
    }

    [Fact]
    public async Task PurchaseBooster_SufficientCoins_DeductsAndGrantsThreeBoostedActivities()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        await shop.AddCoinsAsync(userId, 400);
        var result = await shop.PurchaseBoosterAsync(userId);

        Assert.True(result.Success);
        Assert.Equal(0, result.Coins);
        Assert.Equal(3, result.BoostedActivitiesRemaining);

        var row = await db.UserXp.FindAsync(userId);
        Assert.Equal(0, row!.Coins);
        Assert.Equal(3, row.BoostedActivitiesRemaining);
    }

    [Fact]
    public async Task PurchaseBooster_WhileOneActive_ExtendsRatherThanResets()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        await shop.AddCoinsAsync(userId, 800);
        await shop.PurchaseBoosterAsync(userId); // -> 3 remaining
        var second = await shop.PurchaseBoosterAsync(userId); // -> should be 6, not reset to 3

        Assert.True(second.Success);
        Assert.Equal(6, second.BoostedActivitiesRemaining);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: FAIL to compile — `IShopService` doesn't exist yet.

- [ ] **Step 4: Create `IShopService`**

Create `backend/Sport4You.Api/Services/IShopService.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IShopService
{
    Task AddCoinsAsync(Guid userId, int coinsEarned);
    Task<(int Coins, int BoostedActivitiesRemaining)> GetBalanceAsync(Guid userId);
    Task<ShopCatalogDto> GetCatalogAsync(Guid userId);
    Task<BoosterPurchaseResult> PurchaseBoosterAsync(Guid userId);
    Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier);
    Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId);
}
```

(`GetCatalogAsync`, `PurchaseLootBoxAsync`, and `PurchaseAvatarAsync` are implemented in Tasks 5-7; for this task, throw `NotImplementedException` in the `ShopService` bodies for those three so the class compiles.)

- [ ] **Step 5: Create `ShopService` with coin earning + booster purchase**

Create `backend/Sport4You.Api/Services/ShopService.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class ShopService : IShopService
{
    private const int BoosterPrice = 400;
    private const int BoosterActivities = 3;

    private readonly AppDbContext _db;
    private readonly ILootBoxService _lootBox;

    public ShopService(AppDbContext db, ILootBoxService lootBox)
    {
        _db = db;
        _lootBox = lootBox;
    }

    public async Task AddCoinsAsync(Guid userId, int coinsEarned)
    {
        if (coinsEarned <= 0) return;
        var row = await GetOrCreateUserXpAsync(userId);
        row.Coins += coinsEarned;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<(int Coins, int BoostedActivitiesRemaining)> GetBalanceAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        return (row?.Coins ?? 0, row?.BoostedActivitiesRemaining ?? 0);
    }

    public async Task<BoosterPurchaseResult> PurchaseBoosterAsync(Guid userId)
    {
        var row = await GetOrCreateUserXpAsync(userId);
        if (row.Coins < BoosterPrice)
            return new BoosterPurchaseResult(false, "Insufficient coins", row.Coins, row.BoostedActivitiesRemaining);

        row.Coins -= BoosterPrice;
        row.BoostedActivitiesRemaining += BoosterActivities;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new BoosterPurchaseResult(true, null, row.Coins, row.BoostedActivitiesRemaining);
    }

    public Task<ShopCatalogDto> GetCatalogAsync(Guid userId) => throw new NotImplementedException();
    public Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier) => throw new NotImplementedException();
    public Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId) => throw new NotImplementedException();

    private async Task<UserXp> GetOrCreateUserXpAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        if (row == null)
        {
            row = new UserXp { UserId = userId, TotalXp = 0, PrestigeLevel = 0, Coins = 0, BoostedActivitiesRemaining = 0, UpdatedAt = DateTime.UtcNow };
            _db.UserXp.Add(row);
            await _db.SaveChangesAsync();
        }
        return row;
    }
}
```

- [ ] **Step 6: Register `IShopService` in DI**

Edit `backend/Sport4You.Api/Program.cs`, add alongside the other service registrations:

```csharp
builder.Services.AddScoped<IShopService, ShopService>();
```

- [ ] **Step 7: Wire coin earning into `ActivityService`**

Edit `backend/Sport4You.Api/Services/ActivityService.cs`. Add the `IShopService` dependency to the constructor:

```csharp
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IScoringService _scoring;
    private readonly IXpService _xp;
    private readonly IAchievementService _achievements;
    private readonly IAvatarService _avatars;
    private readonly ILootBoxService _lootBox;
    private readonly IShopService _shop;

    public ActivityService(
        IUserRepository users, IActivityRepository activities,
        IScoringService scoring, IXpService xp,
        IAchievementService achievements, IAvatarService avatars,
        ILootBoxService lootBox, IShopService shop)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
        _xp = xp;
        _achievements = achievements;
        _avatars = avatars;
        _lootBox = lootBox;
        _shop = shop;
    }
```

In `LogActivityAsync`, right after the `xpAward`/`xpEarned` lines (from Task 2 Step 6), add coin earning:

```csharp
        var xpAward = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);
        var xpEarned = xpAward.XpEarned;

        var coinsEarned = points / 10;
        if (coinsEarned > 0)
            await _shop.AddCoinsAsync(userId, coinsEarned);
```

In `LogDailyStepsAsync`, right after the existing `if (xpEarned > 0) await _xp.AwardGenericXpAsync(...)` block, add:

```csharp
        if (xpEarned > 0)
            await _xp.AwardGenericXpAsync(userId, xpEarned, "activity", row.Id);

        var stepsCoinsEarned = pointsEarned / 10;
        if (stepsCoinsEarned > 0)
            await _shop.AddCoinsAsync(userId, stepsCoinsEarned);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter "ShopServiceTests|ActivityService"`
Expected: PASS.

- [ ] **Step 9: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS (all tests — confirms the new `ActivityService` constructor parameter didn't break anything, since no test constructs it directly; all tests go through DI/HTTP).

- [ ] **Step 10: Commit**

```bash
git add backend/Sport4You.Api/DTOs/ShopDtos.cs backend/Sport4You.Api/Services/IShopService.cs backend/Sport4You.Api/Services/ShopService.cs backend/Sport4You.Api/Services/ActivityService.cs backend/Sport4You.Api/Program.cs backend/Sport4You.Tests/ShopServiceTests.cs
git commit -m "feat: earn coins from logged activities, add XP booster purchase"
```

---

### Task 4: Wire `BoostApplied` end-to-end + `ShopController` booster endpoint

**Files:**
- Modify: `backend/Sport4You.Api/Services/IActivityService.cs`
- Modify: `backend/Sport4You.Api/Services/ActivityService.cs`
- Modify: `backend/Sport4You.Api/Controllers/ActivitiesController.cs`
- Create: `backend/Sport4You.Api/Controllers/ShopController.cs`
- Test: `backend/Sport4You.Tests/ShopServiceTests.cs` (new test appended), `backend/Sport4You.Tests/XpServiceTests.cs` (new test appended)

**Interfaces:**
- Consumes: `XpAwardResult.BoostApplied` (Task 2), `IShopService.PurchaseBoosterAsync` (Task 3).
- Produces: `ActivityResult.BoostApplied` (bool); `POST /api/activities` response gains `boostApplied`; `POST /api/users/{userId}/shop/booster` endpoint. Consumed by Task 12 (frontend splash) and the frontend `ApiService` (Task 9).

- [ ] **Step 1: Write the failing end-to-end test**

Append to `backend/Sport4You.Tests/ShopServiceTests.cs` (inside the class, after `PurchaseBooster_WhileOneActive_ExtendsRatherThanResets`):

```csharp
    [Fact]
    public async Task PurchaseBoosterEndpoint_ThenLogActivity_ReturnsBoostAppliedTrue()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        using (var scope = _factory.Services.CreateScope())
        {
            var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
            await shop.AddCoinsAsync(userId, 400);
        }

        var boosterResp = await _client.PostAsync($"/api/users/{userIdStr}/shop/booster", null);
        Assert.Equal(System.Net.HttpStatusCode.OK, boosterResp.StatusCode);

        var activityResp = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId = userIdStr, datetime = "2026-07-01T10:00:00Z", sport = "running", distance = 5.0,
        });
        Assert.Equal(System.Net.HttpStatusCode.OK, activityResp.StatusCode);

        var body = await activityResp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(body.GetProperty("boostApplied").GetBoolean());
        Assert.Equal(150, body.GetProperty("xpEarned").GetInt32()); // floor(5*20) * 1.5 = 150
    }

    [Fact]
    public async Task PurchaseBoosterEndpoint_InsufficientCoins_ReturnsBadRequest()
    {
        var userIdStr = await CreateUserAsync();
        var resp = await _client.PostAsync($"/api/users/{userIdStr}/shop/booster", null);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, resp.StatusCode);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: FAIL — `POST /api/users/{userId}/shop/booster` doesn't exist yet (404), and `boostApplied` isn't in the activity response.

- [ ] **Step 3: Add `BoostApplied` to `ActivityResult`**

Edit `backend/Sport4You.Api/Services/IActivityService.cs`:

```csharp
// backend/Sport4You.Api/Services/IActivityService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points,
    int XpEarned, bool BoostApplied, List<CompletedMissionDto> MissionsCompleted,
    List<UnlockedAchievementDto> AchievementsUnlocked,
    List<UnlockedAvatarDto> AvatarsUnlocked)
{
    public static ActivityResult Success(
        Guid id, int points, int xpEarned, bool boostApplied,
        List<CompletedMissionDto> missions,
        List<UnlockedAchievementDto> achievements,
        List<UnlockedAvatarDto> avatars)
        => new(false, false, null, id, points, xpEarned, boostApplied, missions, achievements, avatars);

    public static ActivityResult BadRequest(string error)
        => new(true, false, error, Guid.Empty, 0, 0, false, [], [], []);

    public static ActivityResult NotFound(string error)
        => new(true, true, error, Guid.Empty, 0, 0, false, [], [], []);
}

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

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
    Task<StepsResult> LogDailyStepsAsync(Guid userId, int steps);
}
```

(`StepsResult` is unchanged — daily steps never apply the booster, per the Global Constraints.)

- [ ] **Step 4: Update `ActivityService.LogActivityAsync`'s two `ActivityResult.Success` call sites**

Edit `backend/Sport4You.Api/Services/ActivityService.cs`. The early-return branch for daily-steps-via-`/api/activities` (around line 59-61) becomes:

```csharp
                : ActivityResult.Success(
                    Guid.Empty, stepsResult.PointsEarned, stepsResult.XpEarned, false,
                    stepsResult.MissionsCompleted, stepsResult.AchievementsUnlocked, stepsResult.AvatarsUnlocked);
```

The final return statement (around line 103-105) becomes:

```csharp
        return ActivityResult.Success(
            activity.Id, points, xpAward.XpEarned, xpAward.BoostApplied,
            missionResult.NewlyCompleted, newAchievements, newAvatars);
```

- [ ] **Step 5: Add `boostApplied` to the controller response**

Edit `backend/Sport4You.Api/Controllers/ActivitiesController.cs`:

```csharp
        return Ok(new
        {
            activityId = result.ActivityId,
            points = result.Points,
            xpEarned = result.XpEarned,
            boostApplied = result.BoostApplied,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
```

- [ ] **Step 6: Create `ShopController` with the booster endpoint**

Create `backend/Sport4You.Api/Controllers/ShopController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class ShopController : ControllerBase
{
    private readonly IShopService _shop;
    public ShopController(IShopService shop) => _shop = shop;

    [HttpPost("shop/booster")]
    public async Task<IActionResult> PurchaseBooster(Guid userId)
    {
        var result = await _shop.PurchaseBoosterAsync(userId);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }
}
```

(`GetShop`, `PurchaseLootBox`, and `PurchaseAvatar` endpoints are added in Tasks 5-7.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: PASS.

- [ ] **Step 8: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS (all tests — confirms the additive `boostApplied` field doesn't break any existing JSON-shape assertions in `ActivitiesControllerTests`/`XpServiceTests`/`AvatarServiceTests`/etc., since those only assert individual properties they care about, not exhaustive shape).

- [ ] **Step 9: Commit**

```bash
git add backend/Sport4You.Api/Services/IActivityService.cs backend/Sport4You.Api/Services/ActivityService.cs backend/Sport4You.Api/Controllers/ActivitiesController.cs backend/Sport4You.Api/Controllers/ShopController.cs backend/Sport4You.Tests/ShopServiceTests.cs
git commit -m "feat: propagate XP boost status to the activity-log response, add booster purchase endpoint"
```

---

### Task 5: Loot box tiers (Normal / Special)

**Files:**
- Modify: `backend/Sport4You.Api/Services/LootBoxService.cs`
- Modify: `backend/Sport4You.Api/Services/ShopService.cs`
- Modify: `backend/Sport4You.Api/Controllers/ShopController.cs`
- Test: `backend/Sport4You.Tests/LootBoxTests.cs` (new tests appended), `backend/Sport4You.Tests/ShopServiceTests.cs` (new tests appended)

**Interfaces:**
- Consumes: `ILootBoxService.EarnBoxAsync(Guid, string)` (existing), `ShopService.GetOrCreateUserXpAsync` (private helper from Task 3, same file).
- Produces: `IShopService.PurchaseLootBoxAsync` now implemented (was a stub in Task 3); `POST /api/users/{userId}/shop/lootbox` endpoint. Consumed by Task 7 (catalog) and Task 12 (frontend shop page).

- [ ] **Step 1: Write the failing rarity-odds test**

Append to `backend/Sport4You.Tests/LootBoxTests.cs` (inside the class, after `GetBorders_NewUser_ReturnsAllBordersLocked`):

```csharp
    [Fact]
    public async Task OpenBox_ShopSpecialReason_UsesSkewedRarityOdds()
    {
        var userId = await CreateUserAsync("Shop", "SpecialOdds");
        using var scope = _factory.Services.CreateScope();
        var lootBox = scope.ServiceProvider.GetRequiredService<Sport4You.Api.Services.ILootBoxService>();
        var uid = Guid.Parse(userId);

        var rarityCounts = new Dictionary<string, int> { ["common"] = 0, ["rare"] = 0, ["legendary"] = 0 };
        const int trials = 300;

        for (var i = 0; i < trials; i++)
        {
            await lootBox.EarnBoxAsync(uid, "shop_special");
            var result = await lootBox.OpenBoxAsync(uid);
            rarityCounts[result.Rarity]++;
        }

        // Special tier is 30/45/25 — assert legendary+rare together clearly dominate
        // common (a wide tolerance band avoids test flakiness from RNG variance).
        var legendaryAndRare = rarityCounts["rare"] + rarityCounts["legendary"];
        Assert.True(legendaryAndRare > rarityCounts["common"],
            $"Expected rare+legendary ({legendaryAndRare}) to outnumber common ({rarityCounts["common"]}) under 30/45/25 odds");
        Assert.True(rarityCounts["legendary"] > trials * 0.15,
            $"Expected legendary count ({rarityCounts["legendary"]}) to exceed 15% of {trials} trials under 25% odds");
    }

    [Fact]
    public async Task OpenBox_ShopNormalReason_UsesSameOddsAsFreeBoxes()
    {
        var userId = await CreateUserAsync("Shop", "NormalOdds");
        using var scope = _factory.Services.CreateScope();
        var lootBox = scope.ServiceProvider.GetRequiredService<Sport4You.Api.Services.ILootBoxService>();
        var uid = Guid.Parse(userId);

        await lootBox.EarnBoxAsync(uid, "shop_normal");
        var result = await lootBox.OpenBoxAsync(uid);

        Assert.Contains(result.Rarity, new[] { "common", "rare", "legendary" });
    }
```

- [ ] **Step 2: Run tests to verify the new behavior test fails**

Run: `cd backend && dotnet test --filter LootBoxTests`
Expected: `OpenBox_ShopSpecialReason_UsesSkewedRarityOdds` FAILs (the current code always uses 60/30/10 regardless of reason, so legendary won't reliably exceed 15% of 300 trials).

- [ ] **Step 3: Make the rarity roll reason-dependent**

Edit `backend/Sport4You.Api/Services/LootBoxService.cs`, replacing the rarity-roll lines inside `OpenBoxAsync`:

```csharp
        var rarityRoll = random.NextDouble();
        var rarity = box.EarnReason == "shop_special"
            ? (rarityRoll < 0.3 ? "common" : rarityRoll < 0.75 ? "rare" : "legendary")
            : (rarityRoll < 0.6 ? "common" : rarityRoll < 0.9 ? "rare" : "legendary");
```

(Everything else in `OpenBoxAsync` — the type roll, candidate lookup, duplicate handling, box update — stays exactly as-is.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter LootBoxTests`
Expected: PASS.

- [ ] **Step 5: Write the failing `PurchaseLootBoxAsync` tests**

Append to `backend/Sport4You.Tests/ShopServiceTests.cs` (inside the class, after the booster tests):

```csharp
    [Fact]
    public async Task PurchaseLootBox_InvalidTier_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var result = await shop.PurchaseLootBoxAsync(userId, "ultra");

        Assert.False(result.Success);
        Assert.Equal("Invalid loot box tier", result.Error);
    }

    [Fact]
    public async Task PurchaseLootBox_Normal_InsufficientCoins_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var result = await shop.PurchaseLootBoxAsync(userId, "normal");

        Assert.False(result.Success);
        Assert.Equal("Insufficient coins", result.Error);
    }

    [Fact]
    public async Task PurchaseLootBox_Normal_SufficientCoins_DeductsAndGrantsPendingBox()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
        var lootBox = scope.ServiceProvider.GetRequiredService<ILootBoxService>();

        await shop.AddCoinsAsync(userId, 500);
        var result = await shop.PurchaseLootBoxAsync(userId, "normal");

        Assert.True(result.Success);
        Assert.Equal(0, result.Coins);
        Assert.Equal(1, result.PendingBoxes);
        Assert.Equal(1, await lootBox.GetPendingCountAsync(userId));
    }

    [Fact]
    public async Task PurchaseLootBox_Special_SufficientCoins_DeductsCorrectPrice()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        await shop.AddCoinsAsync(userId, 1000);
        var result = await shop.PurchaseLootBoxAsync(userId, "special");

        Assert.True(result.Success);
        Assert.Equal(0, result.Coins);
        Assert.Equal(1, result.PendingBoxes);
    }

    [Fact]
    public async Task PurchaseLootBoxEndpoint_ReturnsOkOnSuccess()
    {
        var userIdStr = await CreateUserAsync();
        using (var scope = _factory.Services.CreateScope())
        {
            var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
            await shop.AddCoinsAsync(Guid.Parse(userIdStr), 500);
        }

        var resp = await _client.PostAsJsonAsync($"/api/users/{userIdStr}/shop/lootbox", new { tier = "normal" });
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
    }
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: FAIL — `PurchaseLootBoxAsync` still throws `NotImplementedException`, and `POST /api/users/{userId}/shop/lootbox` doesn't exist yet.

- [ ] **Step 7: Implement `PurchaseLootBoxAsync`**

Edit `backend/Sport4You.Api/Services/ShopService.cs`. Add the price constants near `BoosterPrice`:

```csharp
    private const int BoosterPrice = 400;
    private const int BoosterActivities = 3;
    private const int NormalBoxPrice = 500;
    private const int SpecialBoxPrice = 1000;
```

Replace the `PurchaseLootBoxAsync` stub with:

```csharp
    public async Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier)
    {
        if (tier != "normal" && tier != "special")
            return new LootBoxPurchaseResult(false, "Invalid loot box tier", 0, 0);

        var price = tier == "normal" ? NormalBoxPrice : SpecialBoxPrice;
        var row = await GetOrCreateUserXpAsync(userId);

        if (row.Coins < price)
            return new LootBoxPurchaseResult(false, "Insufficient coins", row.Coins, await _lootBox.GetPendingCountAsync(userId));

        row.Coins -= price;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _lootBox.EarnBoxAsync(userId, tier == "normal" ? "shop_normal" : "shop_special");

        var pendingCount = await _lootBox.GetPendingCountAsync(userId);
        return new LootBoxPurchaseResult(true, null, row.Coins, pendingCount);
    }
```

- [ ] **Step 8: Add the `ShopController` loot box endpoint**

Edit `backend/Sport4You.Api/Controllers/ShopController.cs`, adding after `PurchaseBooster`:

```csharp
    [HttpPost("shop/lootbox")]
    public async Task<IActionResult> PurchaseLootBox(Guid userId, [FromBody] PurchaseLootBoxRequest request)
    {
        var result = await _shop.PurchaseLootBoxAsync(userId, request.Tier);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter "ShopServiceTests|LootBoxTests"`
Expected: PASS.

- [ ] **Step 10: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/Sport4You.Api/Services/LootBoxService.cs backend/Sport4You.Api/Services/ShopService.cs backend/Sport4You.Api/Controllers/ShopController.cs backend/Sport4You.Tests/LootBoxTests.cs backend/Sport4You.Tests/ShopServiceTests.cs
git commit -m "feat: add purchasable Normal/Special loot box tiers"
```

---

### Task 6: Shop avatar purchase

**Files:**
- Modify: `backend/Sport4You.Api/Services/ShopService.cs`
- Modify: `backend/Sport4You.Api/Controllers/ShopController.cs`
- Test: `backend/Sport4You.Tests/ShopServiceTests.cs` (new tests appended)

**Interfaces:**
- Consumes: `Avatar.UnlockType`/`ShopRarity`/`ShopPrice` (Task 1).
- Produces: `IShopService.PurchaseAvatarAsync` now implemented; `POST /api/users/{userId}/shop/avatar` endpoint. Consumed by Task 7 (catalog "owned" flag) and Task 12 (frontend shop page).

- [ ] **Step 1: Write the failing tests**

Append to `backend/Sport4You.Tests/ShopServiceTests.cs` (inside the class, after the loot box tests):

```csharp
    [Fact]
    public async Task PurchaseAvatar_NonShopAvatar_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var nonShopAvatar = await db.Avatars.FirstAsync(a => a.UnlockType == "default");
        var result = await shop.PurchaseAvatarAsync(userId, nonShopAvatar.Id);

        Assert.False(result.Success);
        Assert.Equal("Avatar is not available for purchase", result.Error);
    }

    [Fact]
    public async Task PurchaseAvatar_InsufficientCoins_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var shopAvatar = await db.Avatars.FirstAsync(a => a.Name == "Sleuth Sporty");
        var result = await shop.PurchaseAvatarAsync(userId, shopAvatar.Id);

        Assert.False(result.Success);
        Assert.Equal("Insufficient coins", result.Error);
    }

    [Fact]
    public async Task PurchaseAvatar_SufficientCoins_DeductsCorrectPriceAndUnlocks()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var shopAvatar = await db.Avatars.FirstAsync(a => a.Name == "Sleuth Sporty"); // common, 300
        await shop.AddCoinsAsync(userId, 300);

        var result = await shop.PurchaseAvatarAsync(userId, shopAvatar.Id);

        Assert.True(result.Success);
        Assert.Equal(0, result.Coins);

        var owned = await db.UserAvatars.AnyAsync(ua => ua.UserId == userId && ua.AvatarId == shopAvatar.Id);
        Assert.True(owned);
    }

    [Fact]
    public async Task PurchaseAvatar_AlreadyOwned_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var shopAvatar = await db.Avatars.FirstAsync(a => a.Name == "Sleuth Sporty");
        await shop.AddCoinsAsync(userId, 600);
        await shop.PurchaseAvatarAsync(userId, shopAvatar.Id);

        var second = await shop.PurchaseAvatarAsync(userId, shopAvatar.Id);

        Assert.False(second.Success);
        Assert.Equal("Avatar already owned", second.Error);
    }

    [Fact]
    public async Task PurchaseAvatarEndpoint_AlreadyOwned_ReturnsConflict()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);
        Guid avatarId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
            var shopAvatar = await db.Avatars.FirstAsync(a => a.Name == "Sleuth Sporty");
            avatarId = shopAvatar.Id;
            await shop.AddCoinsAsync(userId, 600);
            await shop.PurchaseAvatarAsync(userId, avatarId);
        }

        var resp = await _client.PostAsJsonAsync($"/api/users/{userIdStr}/shop/avatar", new { avatarId });
        Assert.Equal(System.Net.HttpStatusCode.Conflict, resp.StatusCode);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: FAIL — `PurchaseAvatarAsync` still throws `NotImplementedException`, and the endpoint doesn't exist yet.

- [ ] **Step 3: Implement `PurchaseAvatarAsync`**

Edit `backend/Sport4You.Api/Services/ShopService.cs`. Replace the `PurchaseAvatarAsync` stub with:

```csharp
    public async Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId)
    {
        var avatar = await _db.Avatars.FindAsync(avatarId);
        if (avatar == null || avatar.UnlockType != "shop" || avatar.ShopPrice == null)
            return new AvatarPurchaseResult(false, "Avatar is not available for purchase", 0);

        var alreadyOwned = await _db.UserAvatars.AnyAsync(ua => ua.UserId == userId && ua.AvatarId == avatarId);
        if (alreadyOwned)
            return new AvatarPurchaseResult(false, "Avatar already owned", 0);

        var row = await GetOrCreateUserXpAsync(userId);
        if (row.Coins < avatar.ShopPrice.Value)
            return new AvatarPurchaseResult(false, "Insufficient coins", row.Coins);

        row.Coins -= avatar.ShopPrice.Value;
        row.UpdatedAt = DateTime.UtcNow;
        _db.UserAvatars.Add(new UserAvatar { UserId = userId, AvatarId = avatarId, UnlockedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        return new AvatarPurchaseResult(true, null, row.Coins);
    }
```

(This adds `using Microsoft.EntityFrameworkCore;` usage for `.AnyAsync` — already imported at the top of the file from Task 3.)

- [ ] **Step 4: Add the `ShopController` avatar endpoint**

Edit `backend/Sport4You.Api/Controllers/ShopController.cs`, adding after `PurchaseLootBox`:

```csharp
    [HttpPost("shop/avatar")]
    public async Task<IActionResult> PurchaseAvatar(Guid userId, [FromBody] PurchaseAvatarRequest request)
    {
        var result = await _shop.PurchaseAvatarAsync(userId, request.AvatarId);
        if (!result.Success)
            return result.Error == "Avatar already owned"
                ? Conflict(new { error = result.Error })
                : BadRequest(new { error = result.Error });
        return Ok(result);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/Sport4You.Api/Services/ShopService.cs backend/Sport4You.Api/Controllers/ShopController.cs backend/Sport4You.Tests/ShopServiceTests.cs
git commit -m "feat: add direct-purchase shop avatars"
```

---

### Task 7: Shop catalog endpoint

**Files:**
- Modify: `backend/Sport4You.Api/Services/ShopService.cs`
- Modify: `backend/Sport4You.Api/Controllers/ShopController.cs`
- Test: `backend/Sport4You.Tests/ShopServiceTests.cs` (new tests appended)

**Interfaces:**
- Consumes: `GetBalanceAsync`, `Avatar.UnlockType == "shop"` rows (Task 1).
- Produces: `IShopService.GetCatalogAsync` now implemented; `GET /api/users/{userId}/shop` endpoint. Consumed by Task 12 (frontend shop page) and Task 9 (frontend `ApiService`/model).

- [ ] **Step 1: Write the failing tests**

Append to `backend/Sport4You.Tests/ShopServiceTests.cs` (inside the class, after the avatar tests):

```csharp
    [Fact]
    public async Task GetCatalog_ReturnsBoosterLootBoxesAndSixAvatars()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var catalog = await shop.GetCatalogAsync(userId);

        Assert.Equal(0, catalog.Coins);
        Assert.Equal(0, catalog.BoostedActivitiesRemaining);
        Assert.Equal(400, catalog.Booster.Price);
        Assert.Equal(3, catalog.Booster.BoostedActivities);
        Assert.Equal(2, catalog.LootBoxes.Count);
        Assert.Contains(catalog.LootBoxes, b => b.Tier == "normal" && b.Price == 500);
        Assert.Contains(catalog.LootBoxes, b => b.Tier == "special" && b.Price == 1000);
        Assert.Equal(6, catalog.Avatars.Count);
        Assert.All(catalog.Avatars, a => Assert.False(a.Owned));
    }

    [Fact]
    public async Task GetCatalog_AfterPurchasingAnAvatar_MarksItOwned()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var shopAvatar = await db.Avatars.FirstAsync(a => a.Name == "Sleuth Sporty");
        await shop.AddCoinsAsync(userId, 300);
        await shop.PurchaseAvatarAsync(userId, shopAvatar.Id);

        var catalog = await shop.GetCatalogAsync(userId);
        Assert.True(catalog.Avatars.Single(a => a.Id == shopAvatar.Id).Owned);
    }

    [Fact]
    public async Task GetShopEndpoint_ReturnsOk()
    {
        var userIdStr = await CreateUserAsync();
        var resp = await _client.GetAsync($"/api/users/{userIdStr}/shop");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(6, body.GetProperty("avatars").GetArrayLength());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: FAIL — `GetCatalogAsync` still throws `NotImplementedException`, and `GET /api/users/{userId}/shop` doesn't exist yet.

- [ ] **Step 3: Implement `GetCatalogAsync`**

Edit `backend/Sport4You.Api/Services/ShopService.cs`. Replace the `GetCatalogAsync` stub with:

```csharp
    public async Task<ShopCatalogDto> GetCatalogAsync(Guid userId)
    {
        var (coins, boostedActivitiesRemaining) = await GetBalanceAsync(userId);

        var shopAvatars = await _db.Avatars.Where(a => a.UnlockType == "shop").ToListAsync();
        var ownedIds = await _db.UserAvatars
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AvatarId)
            .ToListAsync();
        var ownedSet = ownedIds.ToHashSet();

        var avatarDtos = shopAvatars
            .Select(a => new ShopAvatarDto(
                a.Id, a.Name, a.Description, a.ImagePath,
                a.ShopRarity ?? "common", a.ShopPrice ?? 0,
                ownedSet.Contains(a.Id)))
            .ToList();

        return new ShopCatalogDto(
            coins,
            boostedActivitiesRemaining,
            new ShopBoosterDto(BoosterPrice, BoosterActivities, 1.5),
            [
                new ShopLootBoxDto("normal", NormalBoxPrice, 60, 30, 10),
                new ShopLootBoxDto("special", SpecialBoxPrice, 30, 45, 25),
            ],
            avatarDtos);
    }
```

- [ ] **Step 4: Add the `ShopController` catalog endpoint**

Edit `backend/Sport4You.Api/Controllers/ShopController.cs`, adding as the first method (right after the constructor, before `PurchaseBooster`):

```csharp
    [HttpGet("shop")]
    public async Task<IActionResult> GetShop(Guid userId)
        => Ok(await _shop.GetCatalogAsync(userId));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter ShopServiceTests`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS (all tests). This is the last backend task — the entire Coins + Shop backend surface is now complete and tested.

- [ ] **Step 7: Commit**

```bash
git add backend/Sport4You.Api/Services/ShopService.cs backend/Sport4You.Api/Controllers/ShopController.cs backend/Sport4You.Tests/ShopServiceTests.cs
git commit -m "feat: add GET /shop catalog endpoint"
```

---

### Task 8: Dashboard integration (Coins + boost status)

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/DashboardDto.cs`
- Modify: `backend/Sport4You.Api/Services/DashboardService.cs`
- Test: `backend/Sport4You.Tests/DashboardControllerTests.cs` (new test appended)

**Interfaces:**
- Consumes: `IShopService.GetBalanceAsync` (Task 3).
- Produces: `DashboardDto.Coins` (int), `DashboardDto.BoostedActivitiesRemaining` (int). Consumed by Task 9/10 (frontend model + dashboard hero).

- [ ] **Step 1: Write the failing test**

Look at `backend/Sport4You.Tests/DashboardControllerTests.cs` first to match its existing style, then append a new test inside the class:

```csharp
    [Fact]
    public async Task Dashboard_ContainsCoinsAndBoostFields()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "DashCoin", lastName = suffix });
        var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        var userId = regBody!["userId"];

        await _client.PostAsJsonAsync("/api/activities", new
        {
            userId, datetime = "2026-07-01T10:00:00Z", sport = "running", distance = 5.0,
        });

        var r = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(50, body.GetProperty("coins").GetInt32()); // floor(500/10) = 50
        Assert.Equal(0, body.GetProperty("boostedActivitiesRemaining").GetInt32());
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && dotnet test --filter Dashboard_ContainsCoinsAndBoostFields`
Expected: FAIL — `coins`/`boostedActivitiesRemaining` don't exist on the dashboard response yet.

- [ ] **Step 3: Add the fields to `DashboardDto`**

Edit `backend/Sport4You.Api/DTOs/DashboardDto.cs`, adding two properties to the `DashboardDto` class (anywhere among the other scalar fields, e.g. right after `TodaySteps`):

```csharp
    public int TodaySteps { get; set; }
    public int Coins { get; set; }
    public int BoostedActivitiesRemaining { get; set; }
```

- [ ] **Step 4: Wire it into `DashboardService`**

Edit `backend/Sport4You.Api/Services/DashboardService.cs`. Add the `IShopService` dependency:

```csharp
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IXpService _xp;
    private readonly IAchievementService _achievements;
    private readonly IAvatarService _avatars;
    private readonly ILeaderboardService _leaderboard;
    private readonly IBorderService _borders;
    private readonly IRivalService _rivals;
    private readonly IShopService _shop;

    public DashboardService(
        IUserRepository users, IActivityRepository activities,
        IXpService xp, IAchievementService achievements,
        IAvatarService avatars, ILeaderboardService leaderboard,
        IBorderService borders, IRivalService rivals, IShopService shop)
    {
        _users = users;
        _activities = activities;
        _xp = xp;
        _achievements = achievements;
        _avatars = avatars;
        _leaderboard = leaderboard;
        _borders = borders;
        _rivals = rivals;
        _shop = shop;
    }
```

In `GetDashboardAsync`, add the balance lookup near the other data-gathering calls (e.g. right after `var rivalStatus = ...`):

```csharp
        var rivalStatus = await _rivals.GetRivalStatusAsync(userId, leaderboard);
        var (coins, boostedActivitiesRemaining) = await _shop.GetBalanceAsync(userId);
```

And set the two new fields in the returned `DashboardDto`:

```csharp
        return new DashboardDto
        {
            User = new UserInfoDto { FirstName = user.FirstName, LastName = user.LastName },
            TotalPoints = activities.Sum(a => a.Points),
            Rank = leaderboardEntry?.Rank ?? 0,
            CurrentStreak = ActivityStreakHelper.ComputeCurrentStreak(activities.Select(a => a.DateTime)),
            TodaySteps = todaySteps,
            Coins = coins,
            BoostedActivitiesRemaining = boostedActivitiesRemaining,
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
            ActiveBorderCss = activeBorderCss,
            RivalStatus = rivalStatus,
        };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && dotnet test --filter Dashboard_ContainsCoinsAndBoostFields`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add backend/Sport4You.Api/DTOs/DashboardDto.cs backend/Sport4You.Api/Services/DashboardService.cs backend/Sport4You.Tests/DashboardControllerTests.cs
git commit -m "feat: surface coin balance and boost status on the dashboard"
```

---

### Task 9: Frontend models + API client methods

**Files:**
- Create: `frontend/src/app/shared/models/shop.model.ts`
- Modify: `frontend/src/app/shared/models/dashboard.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`

**Interfaces:**
- Consumes: `GET /api/users/{id}/shop`, `POST /api/users/{id}/shop/booster`, `POST /api/users/{id}/shop/lootbox`, `POST /api/users/{id}/shop/avatar`, `DashboardDto.Coins`/`BoostedActivitiesRemaining`, `ActivityResult.BoostApplied` (all backend, Tasks 3-8).
- Produces: `ShopCatalog`, `ShopBooster`, `ShopLootBox`, `ShopAvatar`, `BoosterPurchaseResult`, `LootBoxPurchaseResult`, `AvatarPurchaseResult` TS interfaces; `ApiService.getShop/purchaseBooster/purchaseLootBox/purchaseShopAvatar` methods; `DashboardData.coins`/`boostedActivitiesRemaining`; `LogActivityResponse.boostApplied`. Consumed by Task 10 (dashboard hero), Task 11 (activity splash), Task 12 (shop page).

- [ ] **Step 1: Create the shop model file**

Create `frontend/src/app/shared/models/shop.model.ts`:

```typescript
// frontend/src/app/shared/models/shop.model.ts
export interface ShopBooster {
  price: number;
  boostedActivities: number;
  multiplier: number;
}

export interface ShopLootBox {
  tier: 'normal' | 'special';
  price: number;
  commonPct: number;
  rarePct: number;
  legendaryPct: number;
}

export interface ShopAvatar {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  rarity: 'common' | 'rare' | 'legendary';
  price: number;
  owned: boolean;
}

export interface ShopCatalog {
  coins: number;
  boostedActivitiesRemaining: number;
  booster: ShopBooster;
  lootBoxes: ShopLootBox[];
  avatars: ShopAvatar[];
}

export interface BoosterPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
  boostedActivitiesRemaining: number;
}

export interface LootBoxPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
  pendingBoxes: number;
}

export interface AvatarPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
}
```

- [ ] **Step 2: Add `coins`/`boostedActivitiesRemaining` to `DashboardData` and `boostApplied` to `LogActivityResponse`**

Edit `frontend/src/app/shared/models/dashboard.model.ts`. Update `DashboardData`:

```typescript
export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  rank: number;
  currentStreak: number;
  todaySteps: number;
  coins: number;
  boostedActivitiesRemaining: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
  recentAchievements: AchievementStatus[];
  activeAvatar: AvatarStatus | null;
  activeBorderCss: string | null;
  rivalStatus: RivalStatus | null;
}
```

Update `LogActivityResponse`:

```typescript
export interface LogActivityResponse {
  activityId: string;
  points: number;
  xpEarned: number;
  boostApplied: boolean;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
  avatarsUnlocked: UnlockedAvatar[];
}
```

- [ ] **Step 3: Add shop methods to `ApiService`**

Edit `frontend/src/app/shared/services/api.service.ts`. Add the import:

```typescript
import { ShopCatalog, BoosterPurchaseResult, LootBoxPurchaseResult, AvatarPurchaseResult } from '../models/shop.model';
```

Add the four methods at the end of the class, before the closing brace:

```typescript
  getShop(userId: string): Observable<ShopCatalog> {
    return this.http.get<ShopCatalog>(`${this.base}/users/${userId}/shop`);
  }

  purchaseBooster(userId: string): Observable<BoosterPurchaseResult> {
    return this.http.post<BoosterPurchaseResult>(`${this.base}/users/${userId}/shop/booster`, {});
  }

  purchaseLootBox(userId: string, tier: 'normal' | 'special'): Observable<LootBoxPurchaseResult> {
    return this.http.post<LootBoxPurchaseResult>(`${this.base}/users/${userId}/shop/lootbox`, { tier });
  }

  purchaseShopAvatar(userId: string, avatarId: string): Observable<AvatarPurchaseResult> {
    return this.http.post<AvatarPurchaseResult>(`${this.base}/users/${userId}/shop/avatar`, { avatarId });
  }
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS (no TypeScript errors). This will surface any typo in the new interfaces/imports immediately.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/models/shop.model.ts frontend/src/app/shared/models/dashboard.model.ts frontend/src/app/shared/services/api.service.ts
git commit -m "feat: add frontend models and API client methods for the shop"
```

---

### Task 10: Dashboard hero — coin balance + boost chip

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `DashboardData.coins`/`boostedActivitiesRemaining` (Task 9), existing `coin` icon in `ICONS` (`frontend/src/app/shared/constants/icons.constants.ts:9`).

- [ ] **Step 1: Add the coin HUD tile and boost chip CSS**

Edit `frontend/src/app/dashboard/dashboard.component.ts`. In the `styles` array, find the existing `.hud-tile.vault` rules (around line 75-76) and add two new rules right after them:

```typescript
    .hud-tile.vault  { background: linear-gradient(150deg,#4B8DF0,#2E6BE6); box-shadow: 0 8px 16px -8px rgba(46,107,230,.7); }
    .hud-tile.vault.empty { background: #EEF2F8; color: #9aa6bd; box-shadow: none; }
    .hud-tile.coins { background: linear-gradient(150deg,#FFD54A,#F5B300); box-shadow: 0 8px 16px -8px rgba(245,179,0,.7); color: #4a3400; }
    .boost-chip {
      position: absolute; top: -6px; right: 2px;
      background: #2E6BE6; color: #fff; font-family: 'Chakra Petch', sans-serif;
      font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 999px;
      box-shadow: 0 4px 8px -3px rgba(46,107,230,.6);
    }
```

- [ ] **Step 2: Add the coin HUD segment to the template**

In the `template`, find the `.hud` block (around line 297-321) and insert a new `.hud-seg` between the existing "points" segment and the "boxes" segment:

```html
            <div class="hud-seg">
              <div class="hud-tile points"><app-icon name="star" [size]="20" /></div>
              <div class="hud-meta">
                <span class="hud-value">{{ data.totalPoints | number }}</span>
                <span class="hud-label">POINTS</span>
              </div>
            </div>
            <div class="hud-seg">
              <div class="hud-tile coins"><app-icon name="coin" [size]="20" /></div>
              <div class="hud-meta">
                <span class="hud-value">{{ data.coins | number }}</span>
                <span class="hud-label">COINS</span>
              </div>
              @if (data.boostedActivitiesRemaining > 0) {
                <span class="boost-chip">⚡{{ data.boostedActivitiesRemaining }}</span>
              }
            </div>
            <div class="hud-seg" [class.clickable]="pendingBoxes > 0"
                 (click)="pendingBoxes > 0 && openBoxModal()">
```

(The rest of the `.hud` block — the boxes segment — is unchanged.)

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS.

- [ ] **Step 4: Manual browser verification**

Run: `cd frontend && npm start` (in one terminal) and `cd backend/Sport4You.Api && dotnet run` (in another, if not already running).
In the browser: log in as a seeded user (or register a new one), log an activity, navigate to `/dashboard`, and confirm:
- A gold "COINS" tile appears in the top HUD showing a non-zero value after logging an activity.
- No visual regressions to the existing STREAK/POINTS/BOXES tiles.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat: show coin balance and boost status on the dashboard hero"
```

---

### Task 11: Activity confirmation splash — boost line

**Files:**
- Modify: `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

**Interfaces:**
- Consumes: `LogActivityResponse.boostApplied` (Task 9).

- [ ] **Step 1: Add the `boostApplied` property**

Edit `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`. Near the existing `earnedXp = 0;` property declaration (line 358), add:

```typescript
  earnedXp = 0;
  boostApplied = false;
```

- [ ] **Step 2: Set it from the API response**

In the `logActivity()` method's `next` handler, near the existing `this.earnedXp = res.xpEarned ?? 0;` line (526), add:

```typescript
        this.earnedXp = res.xpEarned ?? 0;
        this.boostApplied = res.boostApplied ?? false;
```

- [ ] **Step 3: Add the boost line to the splash template**

Edit the splash's `.conf-sub` line (line 322-324):

```html
          <div class="splash-item conf-sub" style="animation-delay:.31s">
            POINTS EARNED@if (earnedXp > 0) {<span class="conf-sub-xp"> · +{{ earnedXp }} XP</span>}@if (boostApplied) {<span class="conf-sub-boost"> · +50% XP BOOST APPLIED</span>}
          </div>
```

- [ ] **Step 4: Add the CSS for the new span**

Near the existing `.conf-sub-xp { color:#fff; }` rule (line 190), add:

```css
    .conf-sub-xp { color:#fff; }
    .conf-sub-boost { color:#C6E63B; font-weight:700; }
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS.

- [ ] **Step 6: Manual browser verification**

With the backend and frontend dev servers running: purchase an XP booster via a direct API call (e.g. `curl -X POST http://localhost:5262/api/users/<userId>/shop/booster` after giving the user coins, or once Task 12 ships, via the Shop page), then log an activity from the dashboard and confirm the confirmation splash shows "POINTS EARNED · +N XP · +50% XP BOOST APPLIED" in lime green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts
git commit -m "feat: show XP boost line on the activity confirmation splash"
```

---

### Task 12: Shop page (new route + component)

**Files:**
- Create: `frontend/src/app/shop/shop.component.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/app.component.ts`

**Interfaces:**
- Consumes: `ApiService.getShop/purchaseBooster/purchaseLootBox/purchaseShopAvatar` (Task 9), `ShopCatalog`/`ShopAvatar` models (Task 9).

- [ ] **Step 1: Create the Shop page component**

Create `frontend/src/app/shop/shop.component.ts`:

```typescript
// frontend/src/app/shop/shop.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { IconComponent } from '../shared/components/icon/icon.component';
import { ShopCatalog, ShopAvatar } from '../shared/models/shop.model';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, IconComponent],
  styles: [`
    .page { max-width: 960px; margin: 0 auto; padding: 24px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:24px; color:#10203E; }
    .balance { display:flex; align-items:center; gap:8px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#B57C00; }
    .section-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; letter-spacing:.1em; color:#8592ad; margin: 28px 0 12px; }
    .cards { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
    .card {
      background:#fff; border-radius:16px; padding:16px; border:1px solid #eef2f8;
      display:flex; flex-direction:column; gap:10px;
    }
    .card-art { width:100%; aspect-ratio:1; border-radius:12px; overflow:hidden; background:#f5f7fb; }
    .card-art img { width:100%; height:100%; object-fit:cover; display:block; }
    .card-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; color:#10203E; }
    .card-desc { font-size:12px; color:#8592ad; }
    .card-rarity {
      align-self:flex-start; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:10px;
      letter-spacing:.1em; padding:3px 8px; border-radius:999px;
    }
    .card-rarity.common { color:#5c6881; background:#eef2f8; }
    .card-rarity.rare { color:#7E8A9C; background:#F2F5FA; }
    .card-rarity.legendary { color:#B57C00; background:#FBF3DC; }
    .card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:auto; }
    .price { display:flex; align-items:center; gap:6px; font-family:'Chakra Petch',sans-serif; font-weight:700; color:#B57C00; }
    .buy-btn {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em;
      background:#2E6BE6; color:#fff; border:none; border-radius:10px; padding:9px 14px; cursor:pointer;
      transition:transform .1s, background .15s;
    }
    .buy-btn:hover:not(:disabled) { background:#1B47AE; }
    .buy-btn:disabled { background:#e3e9f2; color:#9aa6bd; cursor:not-allowed; }
    .odds { font-size:11px; color:#8592ad; }
    .spinner-wrap { display:flex; justify-content:center; padding:60px 0; }
  `],
  template: `
    <div class="page">
      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading && catalog">
        <div class="header">
          <div class="title">SHOP</div>
          <div class="balance"><app-icon name="coin" [size]="22" /> {{ catalog.coins | number }}</div>
        </div>

        <div class="section-title">XP BOOSTER</div>
        <div class="cards">
          <div class="card">
            <div class="card-name">+{{ ((catalog.booster.multiplier - 1) * 100).toFixed(0) }}% XP Booster</div>
            <div class="card-desc">Boosts your next {{ catalog.booster.boostedActivities }} logged activities.</div>
            <div class="odds" *ngIf="catalog.boostedActivitiesRemaining > 0">
              Active — {{ catalog.boostedActivitiesRemaining }} boosted activities left
            </div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ catalog.booster.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || catalog.coins < catalog.booster.price"
                      (click)="buyBooster()">BUY</button>
            </div>
          </div>
        </div>

        <div class="section-title">LOOT BOXES</div>
        <div class="cards">
          <div class="card" *ngFor="let box of catalog.lootBoxes">
            <div class="card-name">{{ box.tier === 'special' ? 'Special' : 'Normal' }} Loot Box</div>
            <div class="odds">{{ box.commonPct }}% common · {{ box.rarePct }}% rare · {{ box.legendaryPct }}% legendary</div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ box.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || catalog.coins < box.price"
                      (click)="buyLootBox(box.tier)">BUY</button>
            </div>
          </div>
        </div>

        <div class="section-title">AVATARS</div>
        <div class="cards">
          <div class="card" *ngFor="let avatar of catalog.avatars">
            <div class="card-art"><img [src]="avatar.imagePath" [alt]="avatar.name" /></div>
            <div class="card-rarity" [class]="avatar.rarity">{{ avatar.rarity.toUpperCase() }}</div>
            <div class="card-name">{{ avatar.name }}</div>
            <div class="card-desc">{{ avatar.description }}</div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ avatar.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || avatar.owned || catalog.coins < avatar.price"
                      (click)="buyAvatar(avatar)">{{ avatar.owned ? 'OWNED' : 'BUY' }}</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class ShopComponent implements OnInit {
  catalog: ShopCatalog | null = null;
  loading = true;
  buying = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  private load() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loading = true;
    this.api.getShop(userId).subscribe({
      next: (catalog) => { this.catalog = catalog; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  buyBooster() {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying) return;
    this.buying = true;
    this.api.purchaseBooster(userId).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open('XP Booster purchased!', '', { duration: 2500, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: () => { this.buying = false; },
    });
  }

  buyLootBox(tier: 'normal' | 'special') {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying) return;
    this.buying = true;
    this.api.purchaseLootBox(userId, tier).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open('Loot box purchased! Open it from your dashboard.', '', { duration: 3000, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: () => { this.buying = false; },
    });
  }

  buyAvatar(avatar: ShopAvatar) {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying || avatar.owned) return;
    this.buying = true;
    this.api.purchaseShopAvatar(userId, avatar.id).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open(`${avatar.name} unlocked!`, '', { duration: 2500, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: () => { this.buying = false; },
    });
  }
}
```

- [ ] **Step 2: Add the `/shop` route**

Edit `frontend/src/app/app.routes.ts`, adding a new route entry after `achievements`:

```typescript
  {
    path: 'achievements',
    loadComponent: () =>
      import('./achievements/achievements.component').then(m => m.AchievementsComponent),
  },
  {
    path: 'shop',
    loadComponent: () =>
      import('./shop/shop.component').then(m => m.ShopComponent),
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('./profile/profile.component').then(m => m.ProfileComponent),
  },
```

- [ ] **Step 3: Add nav links**

Edit `frontend/src/app/app.component.ts`. In the sidebar `nav-items` (around line 87-100), add a new link between "BADGES" and "PROFILE":

```html
        <a routerLink="/achievements" routerLinkActive="active" class="nav-item">
          <app-icon name="medal" [size]="18" /> BADGES
        </a>
        <a class="nav-item" routerLink="/shop" routerLinkActive="active">
          <app-icon name="coin" [size]="18" /> SHOP
        </a>
        <a class="nav-item" [routerLink]="profileRoute" routerLinkActive="active">
          <app-icon name="user" [size]="18" /> PROFILE
        </a>
```

In the `bottom-nav` (around line 122-134), add the equivalent mobile link between "BADGES" and "PROFILE":

```html
      <a class="bottom-nav-item" routerLink="/achievements" routerLinkActive="active"><app-icon name="medal" [size]="20" /> BADGES</a>
      <a class="bottom-nav-item" routerLink="/shop" routerLinkActive="active"><app-icon name="coin" [size]="20" /> SHOP</a>
      <a class="bottom-nav-item" [routerLink]="profileRoute" routerLinkActive="active">
        <app-icon name="user" [size]="20" /> PROFILE
      </a>
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS.

- [ ] **Step 5: Manual browser verification**

With both dev servers running, log in, click "SHOP" in the sidebar nav, and confirm:
- The page loads without errors and shows a coin balance (0 for a fresh user).
- The XP Booster, both Loot Box tiers, and all 6 avatar cards render (avatar images will 404/show broken-image icons until the art assets from the design spec's AI prompts are generated and placed — this is expected per the Global Constraints).
- Buy buttons are disabled when the balance is insufficient.
- Log a few activities to earn coins, refresh the Shop page, and confirm the balance updates and a purchase succeeds once affordable.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shop/shop.component.ts frontend/src/app/app.routes.ts frontend/src/app/app.component.ts
git commit -m "feat: add Shop page with booster, loot box, and avatar purchases"
```

---

## Self-Review Notes

- **Spec coverage:** Every section of `docs/superpowers/specs/2026-07-06-coins-shop-design.md` maps to a task — data model (Task 1), coin earning (Task 3), XP booster (Tasks 2-4), loot box tiers (Task 5), shop avatars (Task 6), catalog endpoint (Task 7), dashboard integration (Task 8), frontend models/API (Task 9), dashboard hero (Task 10), activity splash (Task 11), Shop page (Task 12). The spec's AI-image-gen prompts are explicitly called out as a manual follow-up, not an automatable task.
- **Type consistency:** `XpAwardResult(int XpEarned, bool BoostApplied)` introduced in Task 2 is used identically in Task 4 (`xpAward.BoostApplied`) and nowhere renamed. `IShopService` methods are declared once in Task 3 and implemented incrementally (stubs → real implementations) in Tasks 3/5/6/7 without signature drift. `ShopCatalogDto`/`ShopAvatarDto`/etc. field names match 1:1 with the frontend `ShopCatalog`/`ShopAvatar` TS interfaces (camelCase JSON serialization is ASP.NET Core's default, consistent with every other DTO in this codebase).
- **Scope check:** This plan is focused on one cohesive feature (currency + shop) built entirely on existing infrastructure patterns (no new tables, no new architectural layers). It's appropriately sized as a single plan — comparable in scope to the existing Personal Records and Platinum Completionist plans in this repo.
