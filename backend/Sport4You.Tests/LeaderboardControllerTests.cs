using System.Net;
using System.Net.Http.Json;
using Sport4You.Api.DTOs;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class LeaderboardControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public LeaderboardControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetLeaderboard_ReturnsUsersRankedByPoints()
    {
        var aliceId = await CreateUserAsync("Alice", "Leader");
        var bobId = await CreateUserAsync("Bob", "Leader");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId = aliceId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = bobId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 5.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);
        Assert.True(entries!.Count >= 2);

        var alice = entries.First(e => e.FirstName == "Alice" && e.LastName == "Leader");
        var bob = entries.First(e => e.FirstName == "Bob" && e.LastName == "Leader");
        Assert.True(alice.Rank < bob.Rank);
        Assert.Equal(1000, alice.TotalPoints);
        Assert.Equal(500, bob.TotalPoints);
    }

    [Fact]
    public async Task GetLeaderboard_ReturnsCorrectRankTrend()
    {
        var alphaId = await CreateUserAsync("Trend", "Alpha");
        var betaId = await CreateUserAsync("Trend", "Beta");

        var oldDate = DateTime.UtcNow.AddDays(-9).ToString("o");

        // Old activities: Beta had more points → Beta was rank 1, Alpha was rank 2
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = oldDate, sport = "running", distance = 20.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = oldDate, sport = "running", distance = 5.0 });

        // Recent activity: Alpha gains enough to overtake Beta in total
        var recentDate = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = recentDate, sport = "running", distance = 30.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);

        var alpha = entries!.First(e => e.FirstName == "Trend" && e.LastName == "Alpha");
        var beta = entries!.First(e => e.FirstName == "Trend" && e.LastName == "Beta");

        // Alpha total = 3500 (rank 1, was rank 2) → trend = +1
        // Beta total = 2000 (rank 2, was rank 1) → trend = -1
        Assert.Equal(3500, alpha.TotalPoints);
        Assert.Equal(2000, beta.TotalPoints);
        Assert.True(alpha.RankTrend > 0, $"Alpha trend should be positive but was {alpha.RankTrend}");
        Assert.True(beta.RankTrend < 0, $"Beta trend should be negative but was {beta.RankTrend}");
    }

    [Fact]
    public async Task GetLeaderboard_IncludesActiveAvatarImagePath()
    {
        var userId = await CreateUserAsync("Avatar", "Leaderboard");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 1.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var entry = entries!.First(e => e.FirstName == "Avatar" && e.LastName == "Leaderboard");
        Assert.NotNull(entry.ActiveAvatarImagePath);
        Assert.StartsWith("assets/avatars/", entry.ActiveAvatarImagePath);
    }
}
