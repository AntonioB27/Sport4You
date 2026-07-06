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
    public async Task LogActivity_Steps_IsAccepted()
    {
        // The assignment's ingestion schema lists `steps` as a field of this endpoint
        // and Daily Steps as a required sport — it must be accepted here.
        var userId = await CreateUserAsync("Step", "Per");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            steps = 1000
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
        Assert.Equal(10, body!["points"].GetInt32()); // floor(1000/100) * 1
    }

    [Fact]
    public async Task LogActivity_StepsSameDay_AccumulatesLikeDedicatedEndpoint()
    {
        var userId = await CreateUserAsync("Step", "Accum");
        await _client.PostAsJsonAsync("/api/activities", new
        { userId, datetime = "2026-06-30T09:00:00Z", steps = 600 });
        var second = await _client.PostAsJsonAsync("/api/activities", new
        { userId, datetime = "2026-06-30T10:00:00Z", steps = 500 });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
        // Incremental points for this call only (500 steps this call, 1100 total that day)
        Assert.Equal(5, body!["points"].GetInt32());
    }

    [Fact]
    public async Task LogActivity_FutureDatetime_Returns400()
    {
        var userId = await CreateUserAsync("Future", "Runner");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("future", body!["error"]);
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
