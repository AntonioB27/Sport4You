using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AiCoachEndpointTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public AiCoachEndpointTests(TestFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Status_WithoutKey_ReportsBasicMode()
    {
        var r = await _client.GetAsync("/api/ai/status");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("basic", body.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task Parse_ReturnsDraftWithPointsPreview()
    {
        var r = await _client.PostAsJsonAsync("/api/activities/parse",
            new { userId = "anyone", text = "ran 5k in 25 min" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("running", body.GetProperty("sport").GetString());
        Assert.Equal(500, body.GetProperty("pointsPreview").GetInt32());
        Assert.False(body.GetProperty("needsClarification").GetBoolean());
    }

    [Fact]
    public async Task Parse_DoesNotLogAnActivity()
    {
        // Register a user, parse (should NOT log), then confirm the dashboard shows no activity.
        var reg = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Parse", lastName = "NoLog" });
        var userId = (await reg.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["userId"];

        await _client.PostAsJsonAsync("/api/activities/parse",
            new { userId, text = "ran 10k" });

        var dash = await _client.GetAsync($"/api/users/{userId}/dashboard");
        var body = await dash.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("activities").GetArrayLength());
    }

    [Fact]
    public async Task Parse_MissingMetric_AsksForClarification()
    {
        var r = await _client.PostAsJsonAsync("/api/activities/parse",
            new { userId = "anyone", text = "went for a run" });
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("needsClarification").GetBoolean());
        Assert.Equal(0, body.GetProperty("pointsPreview").GetInt32());
    }
}
