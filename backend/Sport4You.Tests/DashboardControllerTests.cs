using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class DashboardControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public DashboardControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetDashboard_WithActivity_ReturnsRankGt0AndStreak1()
    {
        var userId = await CreateUserAsync("Dash", "WithActivity");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = DateTime.UtcNow.ToString("o"), sport = "running", distance = 5.0 });

        var response = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("rank").GetInt32() >= 1);
        Assert.Equal(1, body.GetProperty("currentStreak").GetInt32());
    }

    [Fact]
    public async Task GetDashboard_NoActivities_ReturnsRankGt0AndStreak0()
    {
        var userId = await CreateUserAsync("Dash", "NoActivity");

        var response = await _client.GetAsync($"/api/users/{userId}/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("rank").GetInt32() >= 1);
        Assert.Equal(0, body.GetProperty("currentStreak").GetInt32());
    }

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
}
