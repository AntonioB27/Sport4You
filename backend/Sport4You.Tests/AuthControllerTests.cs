using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AuthControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public AuthControllerTests(TestFactory factory) => _client = factory.CreateClient();

    private static object NewUser(string username) => new
    { firstName = "Auth", lastName = "Tester", username, password = "hunter22" };

    [Fact]
    public async Task Register_ThenLogin_ReturnsSameUserIdAndToken()
    {
        var uname = $"user{Guid.NewGuid():N}"[..12];
        var reg = await _client.PostAsJsonAsync("/api/auth/register", NewUser(uname));
        Assert.Equal(System.Net.HttpStatusCode.OK, reg.StatusCode);
        var regBody = await reg.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.False(string.IsNullOrEmpty(regBody.GetProperty("token").GetString()));

        var login = await _client.PostAsJsonAsync("/api/auth/login", new { username = uname, password = "hunter22" });
        Assert.Equal(System.Net.HttpStatusCode.OK, login.StatusCode);
        var loginBody = await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(regBody.GetProperty("userId").GetString(), loginBody.GetProperty("userId").GetString());
    }

    [Fact]
    public async Task Register_DuplicateUsername_Returns409_CaseInsensitive()
    {
        var uname = $"dup{Guid.NewGuid():N}"[..12];
        await _client.PostAsJsonAsync("/api/auth/register", NewUser(uname));
        var r = await _client.PostAsJsonAsync("/api/auth/register", NewUser(uname.ToUpper()));
        Assert.Equal(System.Net.HttpStatusCode.Conflict, r.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401WithGenericMessage()
    {
        var uname = $"pw{Guid.NewGuid():N}"[..12];
        await _client.PostAsJsonAsync("/api/auth/register", NewUser(uname));
        var r = await _client.PostAsJsonAsync("/api/auth/login", new { username = uname, password = "wrong99" });
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("Invalid username or password.", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Login_UnknownUser_Returns401WithSameMessage()
    {
        var r = await _client.PostAsJsonAsync("/api/auth/login", new { username = $"ghost{Guid.NewGuid():N}"[..12], password = "whatever1" });
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("Invalid username or password.", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Register_ShortPassword_Returns400()
    {
        var r = await _client.PostAsJsonAsync("/api/auth/register", new
        { firstName = "A", lastName = "B", username = $"sp{Guid.NewGuid():N}"[..12], password = "abc" });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task PostActivity_WithoutToken_Returns401()
    {
        var r = await _client.PostAsJsonAsync("/api/activities", new
        { userId = Guid.NewGuid(), sport = "running", distance = 5, datetime = DateTime.UtcNow.ToString("o") });
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task PostActivity_ForAnotherUser_Returns403()
    {
        var me = await AuthTestClient.RegisterAsync(_client);
        var other = await AuthTestClient.RegisterAsync(_client);
        _client.WithBearer(me.Token);
        var r = await _client.PostAsJsonAsync("/api/activities", new
        { userId = other.UserId, sport = "running", distance = 5, datetime = DateTime.UtcNow.ToString("o") });
        Assert.Equal(System.Net.HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task Leaderboard_WithoutToken_StaysPublic()
    {
        var r = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
    }
}
