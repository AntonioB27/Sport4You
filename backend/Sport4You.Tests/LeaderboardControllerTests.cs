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

    // Level 10 (IMMORTAL) starts at 60,000 XP; running awards floor(km * 20) XP.
    // 3000 km in one activity lands exactly on the threshold, enabling prestige.
    private async Task ReachLevel10Async(string userId)
    {
        await _client.PostAsJsonAsync("/api/activities", new
        { userId, sport = "running", distance = 3000, datetime = DateTime.UtcNow.ToString("o") });
    }

    [Fact]
    public async Task GetLeaderboard_ReportsPrestigeLevel()
    {
        var prestigedId = await CreateUserAsync("Prestiged", "Athlete");
        var plainId = await CreateUserAsync("Plain", "Athlete");

        // prestigedId climbs to Level 10 and prestiges once.
        await ReachLevel10Async(prestigedId);
        var pr = await _client.PostAsync($"/api/users/{prestigedId}/prestige", null);
        Assert.Equal(HttpStatusCode.OK, pr.StatusCode);

        // plainId logs a normal activity but never prestiges.
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = plainId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 5.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);

        var prestiged = entries!.First(e => e.FirstName == "Prestiged" && e.LastName == "Athlete");
        var plain = entries!.First(e => e.FirstName == "Plain" && e.LastName == "Athlete");

        Assert.Equal(1, prestiged.PrestigeLevel);
        Assert.Equal(0, plain.PrestigeLevel);
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

    [Fact]
    public async Task GetLeaderboard_FilterBySport_OnlyCountsMatchingSportPoints()
    {
        var runnerId = await CreateUserAsync("Sporty", "Runner");
        var cyclistOnlyId = await CreateUserAsync("Sporty", "CyclistOnly");

        var now = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = runnerId, datetime = now, sport = "running", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = runnerId, datetime = now, sport = "cycling", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = cyclistOnlyId, datetime = now, sport = "cycling", distance = 10.0 });

        var response = await _client.GetAsync("/api/leaderboard?sport=running");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);

        var runner = entries!.FirstOrDefault(e => e.FirstName == "Sporty" && e.LastName == "Runner");
        Assert.NotNull(runner);
        Assert.Equal(1000, runner!.TotalPoints); // running only: floor(10km * 100) = 1000, cycling excluded

        Assert.DoesNotContain(entries, e => e.FirstName == "Sporty" && e.LastName == "CyclistOnly");
    }

    [Fact]
    public async Task GetLeaderboard_FilterByPeriod7d_OnlyCountsRecentActivity()
    {
        var userId = await CreateUserAsync("Window", "Runner");

        var tenDaysAgo = DateTime.UtcNow.AddDays(-10).ToString("o");
        var today = DateTime.UtcNow.ToString("o");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = tenDaysAgo, sport = "running", distance = 5.0 });  // 500 pts, outside 7d window
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "running", distance = 2.0 });       // 200 pts, inside 7d window

        var response = await _client.GetAsync("/api/leaderboard?period=7d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var entry = entries!.First(e => e.FirstName == "Window" && e.LastName == "Runner");
        Assert.Equal(200, entry.TotalPoints);
    }

    [Fact]
    public async Task GetLeaderboard_Period7d_RankTrendComparesPriorWindow()
    {
        var alphaId = await CreateUserAsync("SevenDay", "Alpha");
        var betaId = await CreateUserAsync("SevenDay", "Beta");

        var priorWindowDate = DateTime.UtcNow.AddDays(-10).ToString("o");   // inside days 8-14 ago (previous 7d window)
        var currentWindowDate = DateTime.UtcNow.AddDays(-2).ToString("o"); // inside last 7 days (current window)

        // Previous window: Beta ahead of Alpha
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = priorWindowDate, sport = "running", distance = 20.0 });  // 2000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = priorWindowDate, sport = "running", distance = 5.0 });  // 500 pts

        // Current window: Alpha overtakes Beta
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = currentWindowDate, sport = "running", distance = 30.0 }); // 3000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = currentWindowDate, sport = "running", distance = 1.0 });   // 100 pts

        var response = await _client.GetAsync("/api/leaderboard?period=7d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var alpha = entries!.First(e => e.FirstName == "SevenDay" && e.LastName == "Alpha");
        var beta = entries!.First(e => e.FirstName == "SevenDay" && e.LastName == "Beta");

        // Current window: Alpha=3000 (rank 1), Beta=100 (rank 2)
        Assert.Equal(3000, alpha.TotalPoints);
        Assert.Equal(100, beta.TotalPoints);
        // Previous window: Beta=2000 (rank 1), Alpha=500 (rank 2) → Alpha moved up, Beta moved down
        Assert.True(alpha.RankTrend > 0, $"Alpha trend should be positive but was {alpha.RankTrend}");
        Assert.True(beta.RankTrend < 0, $"Beta trend should be negative but was {beta.RankTrend}");
    }

    [Fact]
    public async Task GetLeaderboard_Period30d_RankTrendComparesPriorWindow()
    {
        var alphaId = await CreateUserAsync("ThirtyDay", "Alpha");
        var betaId = await CreateUserAsync("ThirtyDay", "Beta");

        var priorWindowDate = DateTime.UtcNow.AddDays(-40).ToString("o");  // inside days 31-60 ago (previous 30d window)
        var currentWindowDate = DateTime.UtcNow.AddDays(-5).ToString("o"); // inside last 30 days (current window)

        // Previous window: Beta ahead of Alpha
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = priorWindowDate, sport = "running", distance = 20.0 });  // 2000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = priorWindowDate, sport = "running", distance = 5.0 });  // 500 pts

        // Current window: Alpha overtakes Beta
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = currentWindowDate, sport = "running", distance = 30.0 }); // 3000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = currentWindowDate, sport = "running", distance = 1.0 });   // 100 pts

        var response = await _client.GetAsync("/api/leaderboard?period=30d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var alpha = entries!.First(e => e.FirstName == "ThirtyDay" && e.LastName == "Alpha");
        var beta = entries!.First(e => e.FirstName == "ThirtyDay" && e.LastName == "Beta");

        Assert.Equal(3000, alpha.TotalPoints);
        Assert.Equal(100, beta.TotalPoints);
        // Compared relatively (not by absolute sign, unlike the 7d test above): this codebase's
        // DataSeeder seeds demo users with activity entirely within the last 14 days, which falls
        // inside this test's current 30-day window but not its 31-60-day previous window — an
        // asymmetric dilution that can shift both users' absolute rank numbers unevenly between the
        // two windows without changing which of the two improved relative to the other.
        Assert.True(alpha.RankTrend > beta.RankTrend,
            $"Alpha's trend ({alpha.RankTrend}) should exceed Beta's ({beta.RankTrend}) — Alpha overtook Beta this window.");
    }

    [Fact]
    public async Task GetLeaderboard_InvalidPeriod_ReturnsBadRequest()
    {
        var response = await _client.GetAsync("/api/leaderboard?period=90d");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_InvalidSport_ReturnsBadRequest()
    {
        var response = await _client.GetAsync("/api/leaderboard?sport=chess");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
