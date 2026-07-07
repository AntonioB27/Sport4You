using System.Net.Http.Json;
using Sport4You.Api.DTOs;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class SeedDataTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public SeedDataTests(TestFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Seed_CreatesConfiguredUserCount_WithPoints()
    {
        var entries = await _client.GetFromJsonAsync<List<LeaderboardEntryDto>>("/api/leaderboard");
        Assert.NotNull(entries);
        // TestFactory light seed uses UserCount = 5.
        Assert.Equal(5, entries!.Count);
        Assert.All(entries, e => Assert.True(e.TotalPoints >= 0));
        Assert.Contains(entries, e => e.TotalPoints > 0);
    }

    [Fact]
    public async Task Seed_UsersHaveEarnedAchievementsAndActiveBorder()
    {
        var entries = await _client.GetFromJsonAsync<List<LeaderboardEntryDto>>("/api/leaderboard");
        var user = entries!.First();

        // Every seeded user logged at least one activity → "First Blood" unlocks.
        var envelope = await _client.GetFromJsonAsync<AchievementsPageDto>(
            $"/api/users/{user.UserId}/achievements");
        Assert.Contains(envelope!.Achievements, a => a.Name == "First Blood" && a.Unlocked);

        // Phase 3 grants + activates a border for every seeded user, surfaced on the dashboard.
        var dashboard = await _client.GetFromJsonAsync<DashboardDto>(
            $"/api/users/{user.UserId}/dashboard");
        Assert.False(string.IsNullOrEmpty(dashboard!.ActiveBorderCss));
    }
}
