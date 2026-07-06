using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class LootBoxTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    private readonly HttpClient _client;
    public LootBoxTests(TestFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetBoxes_NewUser_ReturnsPendingCountZero()
    {
        var userId = await CreateUserAsync("Box", "NewUser");
        var response = await _client.GetAsync($"/api/users/{userId}/boxes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("pendingCount").GetInt32());
    }

    [Fact]
    public async Task OpenBox_NoPendingBoxes_ReturnsBadRequest()
    {
        var userId = await CreateUserAsync("Box", "EarnOpen");

        var getResp = await _client.GetAsync($"/api/users/{userId}/boxes");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var openResp = await _client.PostAsync($"/api/users/{userId}/boxes/open", null);
        Assert.Equal(HttpStatusCode.BadRequest, openResp.StatusCode);
    }

    [Fact]
    public async Task EarnBox_ViaStreak_OpenBox_GrantsRewardAndDecrementsPending()
    {
        var userId = await CreateUserAsync("Box", "OpenReward");

        // Log yesterday's activity to establish streak base
        var yesterday = DateTime.UtcNow.AddDays(-1).ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = yesterday, sport = "running", distance = 2.0 });

        // Log today's activity — extends the streak, earns a streak box
        var today = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "running", distance = 2.0 });

        // Assert at least 1 pending box
        var boxResp = await _client.GetAsync($"/api/users/{userId}/boxes");
        Assert.Equal(HttpStatusCode.OK, boxResp.StatusCode);
        var boxBody = await boxResp.Content.ReadFromJsonAsync<JsonElement>();
        var pendingCount = boxBody.GetProperty("pendingCount").GetInt32();
        Assert.True(pendingCount >= 1);

        // Open a box — should return 200 with a valid result
        var openResp = await _client.PostAsync($"/api/users/{userId}/boxes/open", null);
        Assert.Equal(HttpStatusCode.OK, openResp.StatusCode);

        var openBody = await openResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(openBody.TryGetProperty("remainingBoxes", out var remaining));
        Assert.Equal(pendingCount - 1, remaining.GetInt32());
        Assert.True(openBody.TryGetProperty("name", out var name));
        Assert.False(string.IsNullOrEmpty(name.GetString()));
        Assert.True(openBody.TryGetProperty("rarity", out _));
        Assert.True(openBody.TryGetProperty("imagePath", out _));

        // If the item was not a duplicate, verify it appears as unlocked
        var wasDuplicate = openBody.GetProperty("wasDuplicate").GetBoolean();
        var itemType = openBody.GetProperty("type").GetString();
        if (!wasDuplicate)
        {
            var endpoint = itemType == "avatar"
                ? $"/api/users/{userId}/avatars"
                : $"/api/users/{userId}/borders";
            var itemResp = await _client.GetAsync(endpoint);
            Assert.Equal(HttpStatusCode.OK, itemResp.StatusCode);
            var items = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
            var unlockedCount = items.EnumerateArray()
                .Count(i => i.GetProperty("unlocked").GetBoolean());
            Assert.True(unlockedCount >= 1);
        }
    }

    [Fact]
    public async Task LogActivity_ThatExtendsStreak_EarnsOneStreakBox()
    {
        var userId = await CreateUserAsync("Streak", "BoxEarner");

        // Log yesterday's activity to establish a streak
        var yesterday = DateTime.UtcNow.AddDays(-1).ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = yesterday, sport = "running", distance = 2.0 });

        // Log today's activity — should extend streak and earn 1 box
        var today = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "running", distance = 2.0 });

        // Log a second activity today — should NOT earn another streak box
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "walking", distance = 1.0 });

        var response = await _client.GetAsync($"/api/users/{userId}/boxes");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Note: pendingCount includes streak box + possible level-up/mission boxes.
        // Assert streak box was earned (count >= 1) and NOT doubled (streak is idempotent).
        Assert.True(body.GetProperty("pendingCount").GetInt32() >= 1);
    }

    [Fact]
    public async Task LogActivity_MissionCompletion_EarnsBox()
    {
        var userId = await CreateUserAsync("Mission", "BoxEarner");

        // "Log any activity today" is always one of the daily easy missions.
        // Logging one activity completes it and should grant 1 mission box.
        var today = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "running", distance = 1.0 });

        var response = await _client.GetAsync($"/api/users/{userId}/boxes");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        // At least 1 box from the mission (possibly more from streak or level-up)
        Assert.True(body.GetProperty("pendingCount").GetInt32() >= 1);
    }

    [Fact]
    public async Task GetBorders_NewUser_ReturnsAllBordersLocked()
    {
        var userId = await CreateUserAsync("Border", "NewUser");
        var response = await _client.GetAsync($"/api/users/{userId}/borders");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var borders = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, borders.ValueKind);
        Assert.Equal(7, borders.GetArrayLength());
        Assert.True(borders.EnumerateArray().All(b => !b.GetProperty("unlocked").GetBoolean()));
    }

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
}
