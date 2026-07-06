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
