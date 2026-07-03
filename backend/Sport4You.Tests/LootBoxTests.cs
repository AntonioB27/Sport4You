using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class LootBoxTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public LootBoxTests(TestFactory factory) => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetBoxes_NewUser_ReturnsPendingCountZero()
    {
        var userId = await CreateUserAsync("Box", "NewUser");
        var response = await _client.GetAsync($"/api/users/{userId}/boxes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("pendingCount").GetInt32());
    }
}
