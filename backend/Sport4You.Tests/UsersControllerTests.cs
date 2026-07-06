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

    [Fact]
    public async Task Login_WithExistingName_ReturnsSameUserId()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var reg = await _client.PostAsJsonAsync("/api/users", new { firstName = "Login", lastName = suffix });
        var regBody = await reg.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "Login", lastName = suffix });
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(regBody!["userId"], body.GetProperty("userId").GetString());
        Assert.Equal("Login", body.GetProperty("firstName").GetString());
    }

    [Fact]
    public async Task Login_WithUnknownName_Returns404()
    {
        var r = await _client.PostAsJsonAsync("/api/users/login",
            new { firstName = "Ghost", lastName = Guid.NewGuid().ToString("N")[..6] });
        Assert.Equal(System.Net.HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateNameDifferentCase_Returns409()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await _client.PostAsJsonAsync("/api/users", new { firstName = "Ivan", lastName = suffix });

        // Names are unique case-insensitively (NOCASE collation) — different casing is a duplicate.
        var response = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "ivan", lastName = suffix.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Login_IsCaseInsensitive_ReturnsSameUser()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var reg = await _client.PostAsJsonAsync("/api/users", new { firstName = "Casey", lastName = suffix });
        var regBody = await reg.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        // Recovery must work regardless of casing, mirroring the case-insensitive uniqueness rule.
        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "casey", lastName = suffix });
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(regBody!["userId"], body.GetProperty("userId").GetString());
    }

    [Fact]
    public async Task Login_WithMissingFields_Returns400()
    {
        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "OnlyFirst" });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, r.StatusCode);
    }
}
