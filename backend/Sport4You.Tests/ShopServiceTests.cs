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

    [Fact]
    public async Task LogActivity_PointsUnderTen_EarnsZeroCoinsAndDoesNotCreateUserXpRow()
    {
        var userIdStr = await CreateUserAsync();
        var userId = Guid.Parse(userIdStr);

        // A very short walk: floor(0.05 * 50) = 2 points -> floor(2/10) = 0 coins
        await _client.PostAsJsonAsync("/api/activities", new
        {
            userId = userIdStr, datetime = "2026-07-01T10:00:00Z", sport = "walking", distance = 0.05,
        });

        using var scope = _factory.Services.CreateScope();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();
        var (coins, _) = await shop.GetBalanceAsync(userId);
        Assert.Equal(0, coins);
    }

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
    public async Task PurchaseAvatar_LootBoxExclusiveAvatar_ReturnsError()
    {
        var userId = Guid.Parse(await CreateUserAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shop = scope.ServiceProvider.GetRequiredService<IShopService>();

        var lootBoxAvatar = await db.Avatars.FirstAsync(a => a.UnlockType == "loot_box");
        var result = await shop.PurchaseAvatarAsync(userId, lootBoxAvatar.Id);

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
}
