using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class XpServiceTests
{
    private readonly XpService _svc = new(null!, null!);  // null deps — pure methods only

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

public class XpServiceIntegrationTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    private readonly TestFactory _factory;

    public XpServiceIntegrationTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<AuthTestClient.AuthUser> CreateUserAsync()
        => await AuthTestClient.RegisterAsync(_client, "Xp");

    [Fact]
    public async Task LogActivity_ReturnsXpEarned()
    {
        var auth = await CreateUserAsync();
        var userId = auth.UserId;
        _client.WithBearer(auth.Token);
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
        var auth = await CreateUserAsync();
        var userId = auth.UserId;
        _client.WithBearer(auth.Token);
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

    [Fact]
    public async Task AwardGenericXp_UpdatesUserXpAndCreatesTransaction()
    {
        var auth = await CreateUserAsync();
        var userId = Guid.Parse(auth.UserId);

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

    [Fact]
    public async Task AwardActivityXp_NoBoost_ReturnsBoostAppliedFalse()
    {
        var userIdStr = (await CreateUserAsync()).UserId;
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
        var userIdStr = (await CreateUserAsync()).UserId;
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
        var userIdStr = (await CreateUserAsync()).UserId;
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
}
