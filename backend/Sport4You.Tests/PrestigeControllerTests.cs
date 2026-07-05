using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class PrestigeControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public PrestigeControllerTests(TestFactory factory) => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    // Level 10 (IMMORTAL) starts at 60,000 XP; running awards floor(km * 20) XP.
    // 3000 km in one activity lands exactly on the threshold.
    private async Task ReachLevel10Async(string userId)
    {
        await _client.PostAsJsonAsync("/api/activities", new
        { userId, sport = "running", distance = 3000, datetime = DateTime.UtcNow.ToString("o") });
    }

    [Fact]
    public async Task Prestige_BelowLevel10_Returns400()
    {
        var userId = await CreateUserAsync("Prestige", "TooEarly");
        var r = await _client.PostAsync($"/api/users/{userId}/prestige", null);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Prestige_AtLevel10_ResetsToLevel1AndIncrementsPrestige()
    {
        var userId = await CreateUserAsync("Prestige", "Ready");
        await ReachLevel10Async(userId);

        var r = await _client.PostAsync($"/api/users/{userId}/prestige", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, body.GetProperty("level").GetInt32());
        Assert.Equal(1, body.GetProperty("prestigeLevel").GetInt32());
        Assert.Equal(0, body.GetProperty("totalXp").GetInt32());

        var dash = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var xp = (await dash.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("xp");
        Assert.Equal(1, xp.GetProperty("level").GetInt32());
        Assert.Equal(1, xp.GetProperty("prestigeLevel").GetInt32());
    }

    [Fact]
    public async Task Prestige_BoostsActivityXp_ByFivePercentPerTier()
    {
        var userId = await CreateUserAsync("Prestige", "Boosted");
        await ReachLevel10Async(userId);
        await _client.PostAsync($"/api/users/{userId}/prestige", null); // now Prestige 1

        // 10 km run = floor(10 * 20) = 200 base XP; at Prestige 1 (+5%) = floor(200 * 1.05) = 210
        var r = await _client.PostAsJsonAsync("/api/activities", new
        { userId, sport = "running", distance = 10, datetime = DateTime.UtcNow.ToString("o") });
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(210, body.GetProperty("xpEarned").GetInt32());
    }

    [Fact]
    public async Task Prestige_DoesNotRevokeAlreadyUnlockedAchievements()
    {
        var userId = await CreateUserAsync("Prestige", "KeepsBadges");
        await ReachLevel10Async(userId); // also unlocks the "Immortal" (Reach Level 10) achievement
        await _client.PostAsync($"/api/users/{userId}/prestige", null);

        var achR = await _client.GetAsync($"/api/users/{userId}/achievements");
        var achievements = (await achR.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("achievements");
        var immortal = achievements.EnumerateArray().First(a => a.GetProperty("name").GetString() == "Immortal");
        Assert.True(immortal.GetProperty("unlocked").GetBoolean());
    }

    [Fact]
    public async Task Prestige_Repeatable_ReachingLevel10AgainIncrementsToTwo()
    {
        var userId = await CreateUserAsync("Prestige", "Repeat");
        await ReachLevel10Async(userId);
        await _client.PostAsync($"/api/users/{userId}/prestige", null); // Prestige 1, back to Level 1

        await ReachLevel10Async(userId); // climb to Level 10 again
        var r = await _client.PostAsync($"/api/users/{userId}/prestige", null);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, body.GetProperty("prestigeLevel").GetInt32());
    }
}
