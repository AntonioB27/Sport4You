using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Sport4You.Api.Services;

/// <summary>
/// Parses activity text via the Anthropic Messages API using a constrained `log_activity` tool.
/// Any failure (network, non-success status, unexpected shape) falls back to the regex parser
/// so the endpoint always returns a usable result.
/// </summary>
public class ClaudeActivityParser : IActivityParser
{
    private const string Model = "claude-haiku-4-5-20251001";
    private const string Endpoint = "https://api.anthropic.com/v1/messages";

    private readonly HttpClient _http;
    private readonly RegexActivityParser _fallback;
    private readonly string _apiKey;
    private readonly ILogger<ClaudeActivityParser> _logger;

    public ClaudeActivityParser(
        HttpClient http,
        RegexActivityParser fallback,
        IConfiguration config,
        ILogger<ClaudeActivityParser> logger)
    {
        _http = http;
        _fallback = fallback;
        _apiKey = config["Anthropic:ApiKey"] ?? string.Empty;
        _logger = logger;
    }

    public async Task<ParsedActivity> ParseAsync(string text)
    {
        try
        {
            var payload = BuildRequest(text);
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            req.Headers.Add("x-api-key", _apiKey);
            req.Headers.Add("anthropic-version", "2023-06-01");

            using var resp = await _http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "ClaudeActivityParser falling back to regex parser: non-success status {StatusCode}",
                    (int)resp.StatusCode);
                return await _fallback.ParseAsync(text);
            }

            var body = await resp.Content.ReadAsStringAsync();
            var parsed = ExtractToolInput(body);
            if (parsed is null)
            {
                _logger.LogWarning(
                    "ClaudeActivityParser falling back to regex parser: response missing usable tool_use content block");
                return await _fallback.ParseAsync(text);
            }
            return parsed;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "ClaudeActivityParser falling back to regex parser: {ExceptionType} {ExceptionMessage}",
                ex.GetType().Name,
                ex.Message);
            return await _fallback.ParseAsync(text);
        }
    }

    private static object BuildRequest(string text) => new
    {
        model = Model,
        max_tokens = 512,
        tool_choice = new { type = "tool", name = "log_activity" },
        tools = new[]
        {
            new
            {
                name = "log_activity",
                description = "Record the fitness activity the user described.",
                input_schema = new
                {
                    type = "object",
                    properties = new Dictionary<string, object>
                    {
                        ["sport"] = new { type = new[] { "string", "null" }, @enum = new object?[] { "running", "walking", "cycling", "swimming", "gym", "daily_steps", null } },
                        ["distanceKm"] = new { type = new[] { "number", "null" } },
                        ["durationSeconds"] = new { type = new[] { "integer", "null" } },
                        ["steps"] = new { type = new[] { "integer", "null" } },
                        ["needsClarification"] = new { type = "boolean" },
                        ["message"] = new { type = "string" },
                        ["confidence"] = new { type = "string", @enum = new[] { "high", "low" } },
                    },
                    required = new[] { "sport", "needsClarification", "message", "confidence" },
                }
            }
        },
        system = "You convert a fitness activity described in natural language into a structured log_activity call. " +
                 "Map to exactly one of: running, walking, cycling, swimming, gym, daily_steps. " +
                 "running/walking/cycling require distanceKm; swimming/gym require durationSeconds; daily_steps requires steps. " +
                 "If the required metric is missing, set needsClarification=true and put a short question in message. " +
                 "If the text is not a fitness activity, set sport=null and needsClarification=true.",
        messages = new[] { new { role = "user", content = text } }
    };

    private static ParsedActivity? ExtractToolInput(string responseBody)
    {
        using var doc = JsonDocument.Parse(responseBody);
        if (!doc.RootElement.TryGetProperty("content", out var content)) return null;
        foreach (var block in content.EnumerateArray())
        {
            if (block.TryGetProperty("type", out var type) && type.GetString() == "tool_use"
                && block.TryGetProperty("input", out var input))
            {
                return new ParsedActivity(
                    Sport: GetStringOrNull(input, "sport"),
                    DistanceKm: GetDecimalOrNull(input, "distanceKm"),
                    DurationSeconds: GetIntOrNull(input, "durationSeconds"),
                    Steps: GetIntOrNull(input, "steps"),
                    NeedsClarification: input.TryGetProperty("needsClarification", out var nc) && nc.GetBoolean(),
                    Message: GetStringOrNull(input, "message") ?? "",
                    Confidence: GetStringOrNull(input, "confidence") ?? "low");
            }
        }
        return null;
    }

    private static string? GetStringOrNull(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static decimal? GetDecimalOrNull(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;
    private static int? GetIntOrNull(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;
}
