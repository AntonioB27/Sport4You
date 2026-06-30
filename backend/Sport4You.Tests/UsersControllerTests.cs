using System.Net;
using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class UsersControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public UsersControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    [Fact]
    public async Task Register_ValidRequest_ReturnsUserId()
    {
        var response = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Alice", lastName = "Smith" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(body);
        Assert.True(Guid.TryParse(body["userId"], out _));
    }

    [Fact]
    public async Task Register_DuplicateName_Returns409()
    {
        await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Bob", lastName = "Jones" });

        var response = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Bob", lastName = "Jones" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("User with this name already exists", body!["error"]);
    }

    [Fact]
    public async Task Register_MissingFirstName_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/users",
            new { lastName = "Smith" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
