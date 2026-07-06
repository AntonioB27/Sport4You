using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class WeightEndpointTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public WeightEndpointTests(TestFactory factory) => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogTwiceSameDay_KeepsOneEntryWithLatestValue()
    {
        var userId = await CreateUserAsync("Weight", "Once");

        await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 80.0 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 79.1 });

        var get = await _client.GetAsync($"/api/users/{userId}/weight");
        var body = await get.Content.ReadFromJsonAsync<JsonElement>();
        var entries = body.GetProperty("entries");
        Assert.Equal(1, entries.GetArrayLength());
        Assert.Equal(79.1, entries[0].GetProperty("weightKg").GetDouble(), 3);
    }

    [Fact]
    public async Task SetGoal_IsReturnedByHistory()
    {
        var userId = await CreateUserAsync("Weight", "Goal");

        var put = await _client.PutAsJsonAsync($"/api/users/{userId}/weight/goal", new { goalKg = 76.5 });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await _client.GetAsync($"/api/users/{userId}/weight");
        var body = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(76.5, body.GetProperty("goalKg").GetDouble(), 3);
    }

    [Fact]
    public async Task UnknownUser_Returns404()
    {
        var get = await _client.GetAsync($"/api/users/{Guid.NewGuid()}/weight");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task NonPositiveWeight_Returns400()
    {
        var userId = await CreateUserAsync("Weight", "Bad");
        var post = await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 0.0 });
        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
    }
}
