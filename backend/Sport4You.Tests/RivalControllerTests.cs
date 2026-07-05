using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class RivalControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public RivalControllerTests(TestFactory factory) => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    private async Task LogRunAsync(string userId, double km)
    {
        await _client.PostAsJsonAsync("/api/activities", new
        { userId, datetime = DateTime.UtcNow.ToString("o"), sport = "running", distance = km });
    }

    [Fact]
    public async Task GetRival_NoneSet_ReturnsNull()
    {
        var userId = await CreateUserAsync("Riv", "NoneSet");
        var r = await _client.GetAsync($"/api/users/{userId}/rival");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, body.GetProperty("rivalUserId").ValueKind);
    }

    [Fact]
    public async Task SetRival_Valid_ReturnsOk_AndGetRivalReflectsIt()
    {
        var userId = await CreateUserAsync("Riv", "SetterA");
        var rivalId = await CreateUserAsync("Riv", "SetterB");

        var put = await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = rivalId });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await _client.GetAsync($"/api/users/{userId}/rival");
        var body = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(rivalId, body.GetProperty("rivalUserId").GetString(), ignoreCase: true);
    }

    [Fact]
    public async Task SetRival_ToSelf_Returns400()
    {
        var userId = await CreateUserAsync("Riv", "SelfCheck");
        var r = await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = userId });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task SetRival_ToNonexistentUser_Returns400()
    {
        var userId = await CreateUserAsync("Riv", "GhostCheck");
        var r = await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task ClearRival_RemovesRivalStatusFromDashboard()
    {
        var userId = await CreateUserAsync("Riv", "ClearerA");
        var rivalId = await CreateUserAsync("Riv", "ClearerB");
        await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = rivalId });

        var del = await _client.DeleteAsync($"/api/users/{userId}/rival");
        Assert.Equal(HttpStatusCode.OK, del.StatusCode);

        var dash = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var body = await dash.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, body.GetProperty("rivalStatus").ValueKind);
    }

    [Fact]
    public async Task Dashboard_ImmediatelyAfterSettingRival_JustFlippedIsFalse()
    {
        var userId = await CreateUserAsync("Riv", "FreshA");
        var rivalId = await CreateUserAsync("Riv", "FreshB");
        await LogRunAsync(userId, 10);   // 1000 pts, ahead of the rival's 0
        await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = rivalId });

        var dash = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var status = (await dash.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("rivalStatus");
        Assert.True(status.GetProperty("imAhead").GetBoolean());
        Assert.False(status.GetProperty("justFlipped").GetBoolean());
    }

    [Fact]
    public async Task Dashboard_AfterRivalOvertakes_JustFlippedTrueThenFalseOnNextLoad()
    {
        var userId = await CreateUserAsync("Riv", "OvertakenA");
        var rivalId = await CreateUserAsync("Riv", "OvertakenB");
        await LogRunAsync(userId, 5);     // 500 pts
        await _client.PutAsJsonAsync($"/api/users/{userId}/rival", new { rivalUserId = rivalId });

        // First dashboard load establishes the "ahead" baseline
        await _client.GetAsync($"/api/users/{userId}/dashboard");

        // Rival overtakes
        await LogRunAsync(rivalId, 20);   // 2000 pts > my 500

        var first = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var firstStatus = (await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("rivalStatus");
        Assert.False(firstStatus.GetProperty("imAhead").GetBoolean());
        Assert.True(firstStatus.GetProperty("justFlipped").GetBoolean());

        var second = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var secondStatus = (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("rivalStatus");
        Assert.False(secondStatus.GetProperty("justFlipped").GetBoolean());
    }
}
