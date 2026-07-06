using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class PersonalRecordsControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public PersonalRecordsControllerTests(TestFactory factory)
    {
        _client = factory.CreateClient();
    }

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetPersonalRecords_NoActivities_ReturnsEmptyDefaults()
    {
        var userId = await CreateUserAsync("Records", "NoActivities");

        var response = await _client.GetAsync($"/api/users/{userId}/personal-records");
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<PersonalRecordsResponse>();

        Assert.NotNull(dto);
        Assert.Empty(dto!.SportRecords);
        Assert.Equal(0, dto.BestDayPoints);
        Assert.Equal(0, dto.LongestStreakEver);
    }

    [Fact]
    public async Task GetPersonalRecords_AfterLoggingRunningActivity_ReturnsRunningRecord()
    {
        var userId = await CreateUserAsync("Records", "WithRun");
        await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = DateTime.UtcNow.ToString("o"),
            sport = "running",
            distance = 7.5m,
        });

        var response = await _client.GetAsync($"/api/users/{userId}/personal-records");
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<PersonalRecordsResponse>();

        Assert.NotNull(dto);
        var running = dto!.SportRecords.Single(r => r.Sport == "running");
        Assert.Equal(7.5m, running.BestDistance);
    }

    private record PersonalRecordsResponse(
        List<SportRecordResponse> SportRecords,
        int BestDayPoints,
        DateTime? BestDayDate,
        int LongestStreakEver);

    private record SportRecordResponse(string Sport, decimal? BestDistance, string? BestDuration, int? BestSteps, DateTime AchievedAt);
}
