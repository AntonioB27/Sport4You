// backend/Sport4You.Tests/AvatarServiceTests.cs
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AvatarServiceTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    private readonly HttpClient _client;

    public AvatarServiceTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Seed_Creates40Avatars()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // 21 regular avatars + 13 loot-box avatars + 6 shop avatars = 40 total
        Assert.Equal(40, await db.Avatars.CountAsync());
    }

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

    [Fact]
    public async Task UnlockAndEquipDefault_GivesDefaultAvatarAndSetsActive()
    {
        var userId = Guid.NewGuid();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User { Id = userId, FirstName = "Def", LastName = "Test" });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        await svc.UnlockAndEquipDefaultAsync(userId);

        var user = await db.Users.FindAsync(userId);
        Assert.NotNull(user!.ActiveAvatarId);

        var ua = await db.UserAvatars.FirstOrDefaultAsync(x => x.UserId == userId);
        Assert.NotNull(ua);
    }

    [Fact]
    public async Task EvaluateAvatars_LevelReached_UnlocksCorrectAvatar()
    {
        var userId = Guid.NewGuid();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User { Id = userId, FirstName = "Lv", LastName = "Test" });
        // Level 2 requires 200 XP — XpService threshold: Level 2 = 200 XP (JOGGER)
        db.UserXp.Add(new UserXp { UserId = userId, TotalXp = 200, UpdatedAt = DateTime.UtcNow });
        // Need at least 1 activity so streak/activity aggregates compute
        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running", Distance = 1m, Points = 100,
        });
        await db.SaveChangesAsync();

        // Pre-unlock default so it's not in the unearned list
        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        await svc.UnlockAndEquipDefaultAsync(userId);

        var result = await svc.EvaluateAvatarsAsync(userId);
        Assert.Contains(result, a => a.Name == "Energized Sporty");
    }

    [Fact]
    public async Task EvaluateAvatars_AchievementEarned_UnlocksMatchingAvatar()
    {
        var userId = Guid.NewGuid();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User { Id = userId, FirstName = "AchAv", LastName = "Test" });
        await db.SaveChangesAsync();

        // Find "First Blood" achievement and unlock it
        var firstBloodAch = await db.Achievements.FirstAsync(a => a.Name == "First Blood");
        db.UserAchievements.Add(new UserAchievement
        {
            UserId = userId, AchievementId = firstBloodAch.Id, UnlockedAt = DateTime.UtcNow,
        });
        db.Activities.Add(new Activity
        {
            Id = Guid.NewGuid(), UserId = userId,
            DateTime = DateTime.UtcNow, Sport = "running", Distance = 1m, Points = 100,
        });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        await svc.UnlockAndEquipDefaultAsync(userId);

        var result = await svc.EvaluateAvatarsAsync(userId);
        Assert.Contains(result, a => a.Name == "First Blood Sporty");
    }

    [Fact]
    public async Task EvaluateAvatars_ActivitiesLogged_UnlocksAtThreshold()
    {
        var userId = Guid.NewGuid();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User { Id = userId, FirstName = "ActAv", LastName = "Test" });

        // Add exactly 10 activities
        for (var i = 0; i < 10; i++)
            db.Activities.Add(new Activity
            {
                Id = Guid.NewGuid(), UserId = userId,
                DateTime = DateTime.UtcNow.AddDays(-i), Sport = "running", Distance = 1m, Points = 100,
            });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        await svc.UnlockAndEquipDefaultAsync(userId);

        var result = await svc.EvaluateAvatarsAsync(userId);
        Assert.Contains(result, a => a.Name == "Active Sporty");
        Assert.DoesNotContain(result, a => a.Name == "Committed Sporty"); // needs 50
    }

    [Fact]
    public async Task EvaluateAvatars_Idempotent_DoesNotDoubleUnlock()
    {
        var userId = Guid.NewGuid();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User { Id = userId, FirstName = "Idem", LastName = "Test" });
        for (var i = 0; i < 10; i++)
            db.Activities.Add(new Activity
            {
                Id = Guid.NewGuid(), UserId = userId,
                DateTime = DateTime.UtcNow.AddDays(-i), Sport = "running", Distance = 1m, Points = 100,
            });
        await db.SaveChangesAsync();

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        await svc.UnlockAndEquipDefaultAsync(userId);

        var first = await svc.EvaluateAvatarsAsync(userId);
        var second = await svc.EvaluateAvatarsAsync(userId);

        var activeCount = first.Count(a => a.Name == "Active Sporty")
                        + second.Count(a => a.Name == "Active Sporty");
        Assert.Equal(1, activeCount);
    }

    [Fact]
    public async Task SetActiveAvatar_ReturnsFalseForLockedAvatar()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var lockedAvatar = await db.Avatars.FirstAsync(a => a.Name == "Legend Sporty");

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        var result = await svc.SetActiveAvatarAsync(userId, lockedAvatar.Id);

        Assert.False(result);
    }

    [Fact]
    public async Task SetActiveAvatar_UpdatesActiveAvatarId()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // The default avatar is already unlocked — equip it (it's already active, but verifies the endpoint)
        var defaultAvatar = await db.Avatars.FirstAsync(a => a.UnlockType == "default");

        var svc = scope.ServiceProvider.GetRequiredService<IAvatarService>();
        var result = await svc.SetActiveAvatarAsync(userId, defaultAvatar.Id);

        Assert.True(result);
        var user = await db.Users.FindAsync(userId);
        Assert.Equal(defaultAvatar.Id, user!.ActiveAvatarId);
    }

    [Fact]
    public async Task RegisterUser_AutoUnlocksDefaultAvatarAndSetsActive()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "Reg", lastName = suffix });
        var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        var userId = Guid.Parse(regBody!["userId"]);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await db.Users.FindAsync(userId);
        Assert.NotNull(user!.ActiveAvatarId);

        var uaCount = await db.UserAvatars.CountAsync(ua => ua.UserId == userId);
        Assert.Equal(1, uaCount);
    }

    [Fact]
    public async Task LogActivity_ResponseContainsAvatarsUnlockedArray()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "AvAct", lastName = suffix });
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
        var avatars = body.GetProperty("avatarsUnlocked");
        Assert.Equal(System.Text.Json.JsonValueKind.Array, avatars.ValueKind);
    }

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

    [Fact]
    public async Task Dashboard_ContainsActiveAvatarField()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var regR = await _client.PostAsJsonAsync("/api/users", new { firstName = "DashAv", lastName = suffix });
        var regBody = await regR.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        var userId = regBody!["userId"];

        var r = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        // activeAvatar must be non-null — default avatar is given at registration
        var activeAvatar = body.GetProperty("activeAvatar");
        Assert.Equal(System.Text.Json.JsonValueKind.Object, activeAvatar.ValueKind);
        var name = activeAvatar.GetProperty("name").GetString();
        Assert.Equal("Starter Sporty", name);
    }

    private async Task<string> CreateUserAsync()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = "Av", lastName = suffix });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

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
}
