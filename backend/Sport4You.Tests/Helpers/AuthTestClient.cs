using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Sport4You.Tests.Helpers;

public static class AuthTestClient
{
    public record AuthUser(string UserId, string Token);

    public static async Task<AuthUser> RegisterAsync(HttpClient client, string firstName = "Test", string? lastName = null)
    {
        lastName ??= Guid.NewGuid().ToString("N")[..6];
        var username = $"u{Guid.NewGuid():N}"[..12];
        var r = await client.PostAsJsonAsync("/api/auth/register", new
        { firstName, lastName, username, password = "test-pass-1" });
        r.EnsureSuccessStatusCode();
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        return new AuthUser(body.GetProperty("userId").GetString()!, body.GetProperty("token").GetString()!);
    }

    public static HttpClient WithBearer(this HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
