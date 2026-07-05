using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class DailyStepsControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public DailyStepsControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    private static int Int(Dictionary<string, JsonElement> body, string key)
        => body[key].GetInt32();

    [Fact]
    public async Task AddSteps_FirstEntry_ReturnsTotalAndPoints()
    {
        var userId = await CreateUserAsync("Step", "One");

        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 5000 });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(5000, Int(body!, "todayTotalSteps"));
        Assert.Equal(50, Int(body!, "pointsEarned"));   // floor(5000/100)
        Assert.Equal(10, Int(body!, "xpEarned"));       // floor(5000/500)
    }

    [Fact]
    public async Task AddSteps_SecondEntry_AccumulatesIntoTotal()
    {
        var userId = await CreateUserAsync("Step", "Two");

        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 5000 });
        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 3000 });

        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(8000, Int(body!, "todayTotalSteps"));
        Assert.Equal(30, Int(body!, "pointsEarned"));   // floor(8000/100) - floor(5000/100) = 80 - 50
        Assert.Equal(6,  Int(body!, "xpEarned"));       // floor(8000/500) - floor(5000/500) = 16 - 10
    }

    [Fact]
    public async Task AddSteps_AccumulationCreatesOneRow_ReflectedInDashboard()
    {
        var userId = await CreateUserAsync("Step", "Three");

        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 4000 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 4000 });

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");
        var stepActivities = dash!["activities"].EnumerateArray()
            .Where(a => a.GetProperty("sport").GetString() == "daily_steps")
            .ToList();
        Assert.Single(stepActivities);                                  // one row, not two
        Assert.Equal(8000, stepActivities[0].GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task AddSteps_CrossesFloorBoundary_AwardsDeltaPoints()
    {
        var userId = await CreateUserAsync("Step", "Floor");

        var first = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 50 });
        var firstBody = await first.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(0, Int(firstBody!, "pointsEarned"));               // floor(50/100) = 0

        var second = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 60 });
        var secondBody = await second.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        Assert.Equal(110, Int(secondBody!, "todayTotalSteps"));
        Assert.Equal(1, Int(secondBody!, "pointsEarned"));             // floor(110/100) - floor(50/100) = 1 - 0
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    [InlineData(100_001)]
    public async Task AddSteps_InvalidAmount_Returns400(int steps)
    {
        var userId = await CreateUserAsync("Step", $"Bad{steps}");

        var res = await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task AddSteps_UnknownUser_Returns404()
    {
        var res = await _client.PostAsJsonAsync($"/api/users/{Guid.NewGuid()}/steps", new { steps = 1000 });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Dashboard_TodaySteps_ReflectsAccumulatedTotal()
    {
        var userId = await CreateUserAsync("Step", "Dash");
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 6000 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/steps", new { steps = 1500 });

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");

        Assert.Equal(7500, dash!["todaySteps"].GetInt32());
    }

    [Fact]
    public async Task Dashboard_TodaySteps_ZeroWhenNoneToday()
    {
        var userId = await CreateUserAsync("Step", "None");

        var dash = await _client.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/users/{userId}/dashboard");

        Assert.Equal(0, dash!["todaySteps"].GetInt32());
    }
}
