using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ClaudeActivityParserTests
{
    private static ClaudeActivityParser Build(HttpStatusCode status, string body)
    {
        var handler = new StubHandler(status, body);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.anthropic.com") };
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Anthropic:ApiKey"] = "test-key" })
            .Build();
        return new ClaudeActivityParser(http, new RegexActivityParser(), config, NullLogger<ClaudeActivityParser>.Instance);
    }

    [Fact]
    public async Task MapsToolUseResponseToParsedActivity()
    {
        var json = """
        {"content":[{"type":"tool_use","name":"log_activity","input":
        {"sport":"running","distanceKm":5.0,"durationSeconds":null,"steps":null,
         "needsClarification":false,"message":"","confidence":"high"}}]}
        """;
        var sut = Build(HttpStatusCode.OK, json);

        var r = await sut.ParseAsync("I did a 5k run");
        Assert.Equal("running", r.Sport);
        Assert.Equal(5.0m, r.DistanceKm);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task FallsBackToRegexOnHttpError()
    {
        var sut = Build(HttpStatusCode.InternalServerError, "boom");

        // Regex fallback still understands this phrasing.
        var r = await sut.ParseAsync("ran 5k in 25 min");
        Assert.Equal("running", r.Sport);
        Assert.Equal(5m, r.DistanceKm);
    }

    [Fact]
    public async Task FallsBackToRegexWhenNoToolUseBlockPresent()
    {
        var json = """{"content":[{"type":"text","text":"hello"}]}""";
        var sut = Build(HttpStatusCode.OK, json);

        // Regex fallback still understands this phrasing.
        var r = await sut.ParseAsync("ran 5k in 25 min");
        Assert.Equal("running", r.Sport);
        Assert.Equal(5m, r.DistanceKm);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task FallsBackToRegexOnMalformedJsonBody()
    {
        var sut = Build(HttpStatusCode.OK, "not json");

        // Regex fallback still understands this phrasing.
        var r = await sut.ParseAsync("ran 5k in 25 min");
        Assert.Equal("running", r.Sport);
        Assert.Equal(5m, r.DistanceKm);
        Assert.False(r.NeedsClarification);
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;
        public StubHandler(HttpStatusCode status, string body) { _status = status; _body = body; }
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json")
            });
    }
}
