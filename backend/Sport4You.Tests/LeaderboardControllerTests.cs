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
}
