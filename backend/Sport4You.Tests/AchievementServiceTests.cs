// backend/Sport4You.Tests/AchievementServiceTests.cs
using System.Net.Http.Json;
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
    public async Task Seed_Creates34Achievements()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Achievements.CountAsync();
        Assert.Equal(34, count);
    }

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

    [Fact]
    public async Task GetUserAchievements_ReturnsAll33WithLockedState()
    {
        var userId = await CreateUserAsync();
        using var scope = _factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var list = await svc.GetUserAchievementsAsync(Guid.Parse(userId));
        Assert.Equal(34, list.Count);
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

    [Fact]
    public async Task GetAchievementsEndpoint_ReturnsXpAnd33Items()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "EndpT", lastName = suffix });
        var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        var userId = regBody!["userId"];

        var r = await _client.GetAsync($"/api/users/{userId}/achievements");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var achievements = body.GetProperty("achievements");
        Assert.Equal(System.Text.Json.JsonValueKind.Array, achievements.ValueKind);
        Assert.Equal(34, achievements.GetArrayLength());
        Assert.True(body.GetProperty("xp").TryGetProperty("level", out _));
    }

    [Fact]
    public async Task GetUserAchievements_ReportsProgressTowardMilestones()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running",
            Distance = 32.0m, Points = 3200,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAchievementService>();
        var list = await svc.GetUserAchievementsAsync(userId);

        var roadWarrior = list.Single(a => a.Name == "Road Warrior");
        Assert.Equal(32.0, roadWarrior.Progress);
        Assert.Equal(50.0, roadWarrior.RequirementValue);
        Assert.Equal("running", roadWarrior.Sport);

        // Steps achievement untouched — zero progress
        var firstMarch = list.Single(a => a.Name == "First March");
        Assert.Equal(0, firstMarch.Progress);
    }

    [Fact]
    public async Task GetUserAchievements_ReportsOwnedByPercent()
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
        await svc.EvaluateAchievementsAsync(userId); // unlocks First Blood
        var list = await svc.GetUserAchievementsAsync(userId);

        var firstBlood = list.Single(a => a.Name == "First Blood");
        Assert.True(firstBlood.Unlocked);
        Assert.InRange(firstBlood.OwnedByPercent, 1, 100);
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

    private async Task<string> CreateUserAsync()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Ach", lastName = suffix });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }
}
