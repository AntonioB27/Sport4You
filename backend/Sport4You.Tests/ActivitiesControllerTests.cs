using System.Net;
using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class ActivitiesControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public ActivitiesControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first = "Test", string last = "User")
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogActivity_Running_ReturnsPoints()
    {
        var userId = await CreateUserAsync("Run", "Ner");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal(500, ((System.Text.Json.JsonElement)body!["points"]).GetInt32());
    }

    [Fact]
    public async Task LogActivity_SwimmingWithDistance_Returns400()
    {
        var userId = await CreateUserAsync("Swim", "Mer");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            sport = "swimming",
            distance = 42.195
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("duration", body!["error"]);
    }

    [Fact]
    public async Task LogActivity_Steps_IsRejected()
    {
        var userId = await CreateUserAsync("Step", "Per");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            steps = 1000
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("steps", body!["error"], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task LogActivity_UnknownUserId_Returns404()
    {
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId = "00000000-0000-0000-0000-000000000000",
            datetime = "2026-06-30T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
