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
        Assert.Equal(33, achievements.GetArrayLength());
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
