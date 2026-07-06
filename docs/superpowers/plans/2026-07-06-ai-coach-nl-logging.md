# AI Coach — Natural-Language Activity Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user describe an activity in plain English ("ran 5k in 25 min") and get a structured, confirmable draft that logs through the existing activity/steps endpoints — powered by Claude when an API key is configured, and a built-in regex parser otherwise.

**Architecture:** A new `IActivityParser` (NL text → `ParsedActivity`) has two implementations selected at startup by API-key presence: `ClaudeActivityParser` (Messages API, tool-use; falls back to regex on failure) and `RegexActivityParser` (offline). A pure `ParseResultMapper` turns a `ParsedActivity` into a `ParseResultDto` with a `ScoringService` points preview. A new `POST /api/activities/parse` returns the draft (never logs); `GET /api/ai/status` reports `ai`/`basic` mode. The frontend adds an always-visible "AI Coach" dashboard entry opening a dialog that parses, shows a confirm card, and on confirm calls the **existing** `POST /api/activities` or `POST /api/users/{id}/steps`.

**Tech Stack:** C# / ASP.NET Core 8 · EF Core · xUnit + WebApplicationFactory (`TestFactory`) · Anthropic Messages API via typed `HttpClient` + `System.Text.Json` (no third-party SDK) · Angular 17 standalone + Angular Material dialog.

## Global Constraints

- Work on `main`; no feature branches. Stage explicit file paths when committing (never `git add -A`). Do not auto-commit — the user commits. (These commit steps are written for completeness; the user runs them.)
- Assignment contracts `POST /api/users` and `POST /api/activities` must not change. Parsing never logs; confirming calls the existing endpoints.
- Daily steps never go through `/api/activities` — `sport: "daily_steps"` there is rejected; steps route to `POST /api/users/{id}/steps`.
- Six sports and exact point formulas (from `ScoringService`): running `floor(km*100)`, walking `floor(km*50)`, cycling `floor(km*25)`, swimming `minutes*15`, gym `minutes*5`, daily_steps `floor(steps/100)`. Duration is an `mm:ss` string; `ScoringService` reads the minutes before the colon.
- API key from configuration key `Anthropic:ApiKey`; backend-only, never sent to the frontend. Model: `claude-haiku-4-5-20251001` (verify id/params against the **claude-api** skill during Task 4).
- Additive only: with no key the app is unchanged everywhere; the AI Coach runs on the regex parser in `basic` mode and manual logging is never blocked.

---

### Task 1: RegexActivityParser (offline NL → ParsedActivity)

**Files:**
- Create: `backend/Sport4You.Api/Services/IActivityParser.cs`
- Create: `backend/Sport4You.Api/Services/RegexActivityParser.cs`
- Test: `backend/Sport4You.Tests/RegexActivityParserTests.cs`

**Interfaces:**
- Produces:
  - `record ParsedActivity(string? Sport, decimal? DistanceKm, int? DurationSeconds, int? Steps, bool NeedsClarification, string Message, string Confidence)` — `Sport` is one of `running|walking|cycling|swimming|gym|daily_steps` or `null`; `Confidence` is `"high"|"low"`.
  - `interface IActivityParser { Task<ParsedActivity> ParseAsync(string text); }`
  - `class RegexActivityParser : IActivityParser`

- [ ] **Step 1: Write the failing tests**

Create `backend/Sport4You.Tests/RegexActivityParserTests.cs`:

```csharp
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class RegexActivityParserTests
{
    private readonly RegexActivityParser _sut = new();

    [Fact]
    public async Task ParsesRunWithDistance()
    {
        var r = await _sut.ParseAsync("ran 5k in 25 min");
        Assert.Equal("running", r.Sport);
        Assert.Equal(5m, r.DistanceKm);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task ParsesDecimalCyclingDistance()
    {
        var r = await _sut.ParseAsync("cycled 12.5 km this morning");
        Assert.Equal("cycling", r.Sport);
        Assert.Equal(12.5m, r.DistanceKm);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task ParsesSwimDuration()
    {
        var r = await _sut.ParseAsync("easy 30 minute swim");
        Assert.Equal("swimming", r.Sport);
        Assert.Equal(1800, r.DurationSeconds);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task ParsesGymDurationWithHours()
    {
        var r = await _sut.ParseAsync("1h 10m gym session");
        Assert.Equal("gym", r.Sport);
        Assert.Equal(4200, r.DurationSeconds);
    }

    [Fact]
    public async Task ParsesStepsAndPrefersStepsOverWalk()
    {
        var r = await _sut.ParseAsync("walked 8,000 steps today");
        Assert.Equal("daily_steps", r.Sport);
        Assert.Equal(8000, r.Steps);
        Assert.False(r.NeedsClarification);
    }

    [Fact]
    public async Task RunWithoutDistanceNeedsClarification()
    {
        var r = await _sut.ParseAsync("went for a run");
        Assert.Equal("running", r.Sport);
        Assert.True(r.NeedsClarification);
        Assert.Null(r.DistanceKm);
    }

    [Fact]
    public async Task NonActivityNeedsClarificationWithNullSport()
    {
        var r = await _sut.ParseAsync("hello there");
        Assert.Null(r.Sport);
        Assert.True(r.NeedsClarification);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~RegexActivityParserTests"`
Expected: FAIL to compile — `IActivityParser`/`RegexActivityParser`/`ParsedActivity` don't exist yet.

- [ ] **Step 3: Create the interface and record**

Create `backend/Sport4You.Api/Services/IActivityParser.cs`:

```csharp
namespace Sport4You.Api.Services;

/// <summary>Structured result of interpreting a free-text activity description.</summary>
public record ParsedActivity(
    string? Sport,
    decimal? DistanceKm,
    int? DurationSeconds,
    int? Steps,
    bool NeedsClarification,
    string Message,
    string Confidence);

public interface IActivityParser
{
    Task<ParsedActivity> ParseAsync(string text);
}
```

- [ ] **Step 4: Implement the regex parser**

Create `backend/Sport4You.Api/Services/RegexActivityParser.cs`:

```csharp
using System.Globalization;
using System.Text.RegularExpressions;

namespace Sport4You.Api.Services;

/// <summary>
/// Offline fallback parser. Recognizes common phrasings without any external call.
/// Steps are checked before walk so "walked 8000 steps" maps to daily_steps.
/// </summary>
public class RegexActivityParser : IActivityParser
{
    public Task<ParsedActivity> ParseAsync(string text)
    {
        var t = (text ?? string.Empty).ToLowerInvariant();

        var sport = DetectSport(t);
        if (sport is null)
            return Done(new ParsedActivity(null, null, null, null, true,
                "I couldn't tell which activity that was. Try e.g. \"ran 5k in 25 min\".", "low"));

        switch (sport)
        {
            case "running":
            case "walking":
            case "cycling":
                var km = FindDistanceKm(t);
                return km is null
                    ? Clarify(sport, $"How far did you {VerbFor(sport)} (in km)?")
                    : Done(new ParsedActivity(sport, km, null, null, false, "", "high"));

            case "swimming":
            case "gym":
                var secs = FindDurationSeconds(t);
                return secs is null
                    ? Clarify(sport, "How long did that take (in minutes)?")
                    : Done(new ParsedActivity(sport, null, secs, null, false, "", "high"));

            default: // daily_steps
                var steps = FindSteps(t);
                return steps is null
                    ? Clarify(sport, "How many steps was that?")
                    : Done(new ParsedActivity(sport, null, null, steps, false, "", "high"));
        }
    }

    private static Task<ParsedActivity> Done(ParsedActivity p) => Task.FromResult(p);
    private static Task<ParsedActivity> Clarify(string sport, string msg) =>
        Task.FromResult(new ParsedActivity(sport, null, null, null, true, msg, "low"));

    private static string VerbFor(string sport) => sport switch
    {
        "running" => "run", "walking" => "walk", "cycling" => "cycle", _ => "go"
    };

    private static string? DetectSport(string t)
    {
        if (Regex.IsMatch(t, @"\bsteps?\b")) return "daily_steps";
        if (Regex.IsMatch(t, @"\b(cycl|bike|biked|biking)")) return "cycling";
        if (Regex.IsMatch(t, @"\b(run|ran|running|jog)")) return "running";
        if (Regex.IsMatch(t, @"\bswam\b|\bswim")) return "swimming";
        if (Regex.IsMatch(t, @"\b(gym|lift|lifted|weights|workout|bench)")) return "gym";
        if (Regex.IsMatch(t, @"\bwalk")) return "walking";
        return null;
    }

    private static decimal? FindDistanceKm(string t)
    {
        // "5k", "5 km", "12.5 km", "5.2 kilometers"
        var m = Regex.Match(t, @"(\d+(?:\.\d+)?)\s*(k\b|km|kilometer)");
        return m.Success ? decimal.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) : null;
    }

    private static int? FindDurationSeconds(string t)
    {
        var hours = Regex.Match(t, @"(\d+)\s*h(?:our|r)?s?\b");
        var mins = Regex.Match(t, @"(\d+)\s*m(?:in(?:ute)?s?)?\b");
        if (!hours.Success && !mins.Success) return null;
        var total = 0;
        if (hours.Success) total += int.Parse(hours.Groups[1].Value) * 3600;
        if (mins.Success) total += int.Parse(mins.Groups[1].Value) * 60;
        return total == 0 ? null : total;
    }

    private static int? FindSteps(string t)
    {
        var m = Regex.Match(t, @"(\d[\d,]*)\s*steps?");
        return m.Success ? int.Parse(m.Groups[1].Value.Replace(",", "")) : null;
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~RegexActivityParserTests"`
Expected: PASS (7/7).

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/IActivityParser.cs \
        backend/Sport4You.Api/Services/RegexActivityParser.cs \
        backend/Sport4You.Tests/RegexActivityParserTests.cs
git commit -m "feat: offline regex activity parser (IActivityParser)"
```

---

### Task 2: ParseResultMapper + ParseResultDto (draft + points preview)

**Files:**
- Create: `backend/Sport4You.Api/DTOs/ParseResultDto.cs`
- Create: `backend/Sport4You.Api/Services/ParseResultMapper.cs`
- Test: `backend/Sport4You.Tests/ParseResultMapperTests.cs`

**Interfaces:**
- Consumes: `ParsedActivity` (Task 1); `IScoringService.CalculatePoints(string sport, decimal? distance, string? duration, int? steps)` (existing).
- Produces:
  - `class ParseResultDto` with `{ string? Sport; decimal? DistanceKm; int? DurationSeconds; int? Steps; int PointsPreview; string Confidence; bool NeedsClarification; string Message; }`
  - `static class ParseResultMapper { static ParseResultDto ToDto(ParsedActivity parsed, IScoringService scoring); static string DurationToMmSs(int totalSeconds); }`

- [ ] **Step 1: Write the failing tests**

Create `backend/Sport4You.Tests/ParseResultMapperTests.cs`:

```csharp
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ParseResultMapperTests
{
    private readonly ScoringService _scoring = new();

    [Fact]
    public void RunningPreviewUsesScoring()
    {
        var parsed = new ParsedActivity("running", 5m, null, null, false, "", "high");
        var dto = ParseResultMapper.ToDto(parsed, _scoring);
        Assert.Equal("running", dto.Sport);
        Assert.Equal(5m, dto.DistanceKm);
        Assert.Equal(500, dto.PointsPreview);   // floor(5*100)
        Assert.False(dto.NeedsClarification);
    }

    [Fact]
    public void SwimmingConvertsSecondsAndPreviews()
    {
        var parsed = new ParsedActivity("swimming", null, 1800, null, false, "", "high");
        var dto = ParseResultMapper.ToDto(parsed, _scoring);
        Assert.Equal(1800, dto.DurationSeconds);
        Assert.Equal(450, dto.PointsPreview);   // 30 min * 15
    }

    [Fact]
    public void StepsPreview()
    {
        var parsed = new ParsedActivity("daily_steps", null, null, 8000, false, "", "high");
        var dto = ParseResultMapper.ToDto(parsed, _scoring);
        Assert.Equal(80, dto.PointsPreview);    // floor(8000/100)
    }

    [Fact]
    public void ClarificationYieldsZeroPreviewAndNoThrow()
    {
        var parsed = new ParsedActivity("running", null, null, null, true, "How far?", "low");
        var dto = ParseResultMapper.ToDto(parsed, _scoring);
        Assert.Equal(0, dto.PointsPreview);
        Assert.True(dto.NeedsClarification);
        Assert.Equal("How far?", dto.Message);
    }

    [Fact]
    public void DurationToMmSsFormatsMinutesAndSeconds()
    {
        Assert.Equal("30:00", ParseResultMapper.DurationToMmSs(1800));
        Assert.Equal("70:00", ParseResultMapper.DurationToMmSs(4200));
        Assert.Equal("25:30", ParseResultMapper.DurationToMmSs(1530));
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~ParseResultMapperTests"`
Expected: FAIL to compile — `ParseResultDto`/`ParseResultMapper` don't exist.

- [ ] **Step 3: Create the DTO**

Create `backend/Sport4You.Api/DTOs/ParseResultDto.cs`:

```csharp
namespace Sport4You.Api.DTOs;

public class ParseResultDto
{
    public string? Sport { get; set; }
    public decimal? DistanceKm { get; set; }
    public int? DurationSeconds { get; set; }
    public int? Steps { get; set; }
    public int PointsPreview { get; set; }
    public string Confidence { get; set; } = "low";
    public bool NeedsClarification { get; set; }
    public string Message { get; set; } = string.Empty;
}
```

- [ ] **Step 4: Implement the mapper**

Create `backend/Sport4You.Api/Services/ParseResultMapper.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

/// <summary>Pure mapping from a ParsedActivity to the API draft, with a points preview.</summary>
public static class ParseResultMapper
{
    public static ParseResultDto ToDto(ParsedActivity parsed, IScoringService scoring)
    {
        var dto = new ParseResultDto
        {
            Sport = parsed.Sport,
            DistanceKm = parsed.DistanceKm,
            DurationSeconds = parsed.DurationSeconds,
            Steps = parsed.Steps,
            Confidence = parsed.Confidence,
            NeedsClarification = parsed.NeedsClarification,
            Message = parsed.Message,
            PointsPreview = 0,
        };

        if (parsed.NeedsClarification || parsed.Sport is null)
            return dto;

        var duration = parsed.DurationSeconds is int secs ? DurationToMmSs(secs) : null;
        try
        {
            dto.PointsPreview = scoring.CalculatePoints(
                parsed.Sport, parsed.DistanceKm, duration, parsed.Steps);
        }
        catch (ArgumentException)
        {
            dto.PointsPreview = 0; // required metric missing — leave preview at 0
        }
        return dto;
    }

    public static string DurationToMmSs(int totalSeconds)
    {
        var minutes = totalSeconds / 60;
        var seconds = totalSeconds % 60;
        return $"{minutes}:{seconds:D2}";
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~ParseResultMapperTests"`
Expected: PASS (5/5).

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/DTOs/ParseResultDto.cs \
        backend/Sport4You.Api/Services/ParseResultMapper.cs \
        backend/Sport4You.Tests/ParseResultMapperTests.cs
git commit -m "feat: ParseResultMapper with ScoringService points preview"
```

---

### Task 3: Endpoints + DI wiring (parse draft + AI status, no-key path)

**Files:**
- Create: `backend/Sport4You.Api/DTOs/ParseActivityRequest.cs`
- Create: `backend/Sport4You.Api/Controllers/AiController.cs`
- Modify: `backend/Sport4You.Api/Controllers/ActivitiesController.cs`
- Modify: `backend/Sport4You.Api/Program.cs`
- Test: `backend/Sport4You.Tests/AiCoachEndpointTests.cs`

**Interfaces:**
- Consumes: `IActivityParser` (Task 1), `ParseResultMapper.ToDto` (Task 2), `IScoringService` (existing).
- Produces:
  - `POST /api/activities/parse` body `{ userId, text }` → `ParseResultDto` (JSON camelCase). Writes nothing.
  - `GET /api/ai/status` → `{ mode: "ai" | "basic" }`.
  - DI: `IActivityParser` bound to `RegexActivityParser` when no `Anthropic:ApiKey` is configured.

- [ ] **Step 1: Write the failing integration tests**

Create `backend/Sport4You.Tests/AiCoachEndpointTests.cs`. `TestFactory` builds with no `Anthropic:ApiKey`, so this exercises the regex/basic path:

```csharp
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~AiCoachEndpointTests"`
Expected: FAIL — endpoints return 404 (routes don't exist yet).

- [ ] **Step 3: Create the request DTO**

Create `backend/Sport4You.Api/DTOs/ParseActivityRequest.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class ParseActivityRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Text { get; set; } = string.Empty;
}
```

- [ ] **Step 4: Add the parse action to ActivitiesController**

In `backend/Sport4You.Api/Controllers/ActivitiesController.cs`, add `IActivityParser` and `IScoringService` to the constructor and add the `parse` action. Full updated file:

```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityService _activities;
    private readonly IActivityParser _parser;
    private readonly IScoringService _scoring;

    public ActivitiesController(IActivityService activities, IActivityParser parser, IScoringService scoring)
    {
        _activities = activities;
        _parser = parser;
        _scoring = scoring;
    }

    [HttpPost]
    public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest request)
    {
        var result = await _activities.LogActivityAsync(request);
        if (result.IsNotFound)
            return NotFound(new { error = result.Error });
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new
        {
            activityId = result.ActivityId,
            points = result.Points,
            xpEarned = result.XpEarned,
            boostApplied = result.BoostApplied,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
    }

    /// <summary>Interprets free text into a draft activity. Does NOT log anything.</summary>
    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromBody] ParseActivityRequest request)
    {
        // Cap input length to guard against abuse / runaway tokens.
        var text = request.Text.Length > 300 ? request.Text[..300] : request.Text;
        var parsed = await _parser.ParseAsync(text);
        return Ok(ParseResultMapper.ToDto(parsed, _scoring));
    }
}
```

- [ ] **Step 5: Create the AI status controller**

Create `backend/Sport4You.Api/Controllers/AiController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/ai")]
public class AiController : ControllerBase
{
    private readonly IConfiguration _config;
    public AiController(IConfiguration config) => _config = config;

    /// <summary>"ai" when an Anthropic key is configured, otherwise "basic" (regex fallback).</summary>
    [HttpGet("status")]
    public IActionResult Status()
    {
        var hasKey = !string.IsNullOrWhiteSpace(_config["Anthropic:ApiKey"]);
        return Ok(new { mode = hasKey ? "ai" : "basic" });
    }
}
```

- [ ] **Step 6: Wire DI in Program.cs (regex by default; Claude added in Task 4)**

In `backend/Sport4You.Api/Program.cs`, add these registrations next to the other `AddScoped` lines (after the `IScoringService` registration). This task wires only the regex parser; Task 4 extends the key-present branch:

```csharp
builder.Services.AddScoped<RegexActivityParser>();

var anthropicKey = builder.Configuration["Anthropic:ApiKey"];
if (string.IsNullOrWhiteSpace(anthropicKey))
{
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<RegexActivityParser>());
}
else
{
    // Task 4 replaces this branch with the Claude-backed parser.
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<RegexActivityParser>());
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~AiCoachEndpointTests"`
Expected: PASS (4/4).

- [ ] **Step 8: Run the full backend suite**

Run: `dotnet test backend/Sport4You.Tests`
Expected: PASS (all existing tests plus the new ones). The `ActivitiesController` constructor change resolves via DI — `IActivityParser` and `IScoringService` are both registered.

- [ ] **Step 9: Commit**

```bash
git add backend/Sport4You.Api/DTOs/ParseActivityRequest.cs \
        backend/Sport4You.Api/Controllers/AiController.cs \
        backend/Sport4You.Api/Controllers/ActivitiesController.cs \
        backend/Sport4You.Api/Program.cs \
        backend/Sport4You.Tests/AiCoachEndpointTests.cs
git commit -m "feat: /api/activities/parse and /api/ai/status (regex/basic mode)"
```

---

### Task 4: ClaudeActivityParser (LLM integration with regex fallback)

**Files:**
- Create: `backend/Sport4You.Api/Services/ClaudeActivityParser.cs`
- Modify: `backend/Sport4You.Api/Program.cs` (key-present branch)
- Test: `backend/Sport4You.Tests/ClaudeActivityParserTests.cs`

**Interfaces:**
- Consumes: `IActivityParser`/`ParsedActivity` (Task 1); `RegexActivityParser` (Task 1, used as fallback); `HttpClient`; `IConfiguration`.
- Produces: `class ClaudeActivityParser : IActivityParser` — calls the Anthropic Messages API with a `log_activity` tool; on any failure returns the `RegexActivityParser` result for the same text.

**Before coding:** read the **claude-api** skill to confirm the current model id, endpoint, headers, and tool-use request/response shape. The code below targets the Anthropic Messages API (`POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`) and model `claude-haiku-4-5-20251001`; adjust if the skill specifies otherwise.

- [ ] **Step 1: Write the failing tests**

Create `backend/Sport4You.Tests/ClaudeActivityParserTests.cs`. A stub `HttpMessageHandler` returns a canned Messages API `tool_use` response, so no network is used:

```csharp
using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
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
        return new ClaudeActivityParser(http, new RegexActivityParser(), config);
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~ClaudeActivityParserTests"`
Expected: FAIL to compile — `ClaudeActivityParser` doesn't exist.

- [ ] **Step 3: Implement the Claude parser**

Create `backend/Sport4You.Api/Services/ClaudeActivityParser.cs`:

```csharp
using System.Text;
using System.Text.Json;

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

    public ClaudeActivityParser(HttpClient http, RegexActivityParser fallback, IConfiguration config)
    {
        _http = http;
        _fallback = fallback;
        _apiKey = config["Anthropic:ApiKey"] ?? string.Empty;
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
            if (!resp.IsSuccessStatusCode) return await _fallback.ParseAsync(text);

            var body = await resp.Content.ReadAsStringAsync();
            var parsed = ExtractToolInput(body);
            return parsed ?? await _fallback.ParseAsync(text);
        }
        catch
        {
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
```

- [ ] **Step 4: Point the key-present DI branch at Claude**

In `backend/Sport4You.Api/Program.cs`, replace the `else` branch added in Task 3 with the Claude registration:

```csharp
builder.Services.AddScoped<RegexActivityParser>();

var anthropicKey = builder.Configuration["Anthropic:ApiKey"];
if (string.IsNullOrWhiteSpace(anthropicKey))
{
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<RegexActivityParser>());
}
else
{
    builder.Services.AddHttpClient<ClaudeActivityParser>();
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<ClaudeActivityParser>());
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~ClaudeActivityParserTests"`
Expected: PASS (2/2).

- [ ] **Step 6: Run the full backend suite**

Run: `dotnet test backend/Sport4You.Tests`
Expected: PASS. (No key is set in tests, so the app/DI still resolves the regex parser; the Claude parser is exercised only by its mocked-HTTP unit tests.)

- [ ] **Step 7: Commit**

```bash
git add backend/Sport4You.Api/Services/ClaudeActivityParser.cs \
        backend/Sport4You.Api/Program.cs \
        backend/Sport4You.Tests/ClaudeActivityParserTests.cs
git commit -m "feat: Claude-backed activity parser with regex fallback"
```

---

### Task 5: Frontend — AI Coach entry, dialog, and confirm flow

**Files:**
- Create: `frontend/src/app/shared/models/ai-coach.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`
- Create: `frontend/src/app/dashboard/ai-coach/ai-coach-dialog.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `POST /api/activities/parse` → `ParseResult`; `GET /api/ai/status` → `{ mode }`; existing `logActivity(request)` and `addSteps(userId, steps)` on `ApiService`.
- Produces: an `AiCoachDialogComponent` opened from a dashboard "AI Coach" card; on confirm it logs via the existing endpoints and closes.

- [ ] **Step 1: Add the model**

Create `frontend/src/app/shared/models/ai-coach.model.ts`:

```typescript
export interface ParseResult {
  sport: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  steps: number | null;
  pointsPreview: number;
  confidence: 'high' | 'low';
  needsClarification: boolean;
  message: string;
}

export interface AiStatus {
  mode: 'ai' | 'basic';
}
```

- [ ] **Step 2: Add ApiService methods**

In `frontend/src/app/shared/services/api.service.ts`, add the import and two methods (place the methods next to `logActivity`):

```typescript
import { ParseResult, AiStatus } from '../models/ai-coach.model';
```

```typescript
  getAiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.base}/ai/status`);
  }

  parseActivity(userId: string, text: string): Observable<ParseResult> {
    return this.http.post<ParseResult>(`${this.base}/activities/parse`, { userId, text });
  }
```

- [ ] **Step 3: Create the AI Coach dialog**

Create `frontend/src/app/dashboard/ai-coach/ai-coach-dialog.component.ts`. It parses text, shows a confirm card with the points preview, and on confirm calls the existing activity/steps endpoints. Duration is converted from seconds to the `mm:ss` string the log endpoint expects, and the datetime defaults to now:

```typescript
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { ParseResult } from '../../shared/models/ai-coach.model';

@Component({
  selector: 'app-ai-coach-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  styles: [`
    .wrap { padding: 22px; font-family: 'Nunito', system-ui, sans-serif; width: 380px; max-width: 100%; }
    .title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #10203E; display: flex; align-items: center; gap: 8px; }
    .mode { font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; color: #8592ad; margin-left: auto; }
    .mode.basic { color: #B78A00; }
    .sub { color: #5c6881; font-size: 13px; margin: 6px 0 14px; }
    textarea { width: 100%; border: 1px solid #d6e0ee; border-radius: 12px; padding: 12px; font: inherit; resize: vertical; min-height: 64px; }
    .btn { border: none; cursor: pointer; font-family: 'Chakra Petch', sans-serif; font-weight: 700; letter-spacing: .05em; border-radius: 12px; padding: 12px 18px; }
    .btn.primary { background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; box-shadow: 0 4px 0 #7c9c00; }
    .btn.ghost { background: #fff; border: 1px solid #d6e0ee; color: #5c6881; }
    .row { display: flex; gap: 10px; margin-top: 14px; }
    .draft { margin-top: 16px; border-radius: 14px; padding: 16px; background: #F6FBEA; border: 1px solid rgba(158,207,16,.5); }
    .draft-line { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 16px; color: #10203E; }
    .draft-pts { color: #4a6100; }
    .clarify { margin-top: 16px; border-radius: 14px; padding: 14px; background: #FFF7E6; border: 1px solid #FFE0A3; color: #8B5E00; font-size: 13px; }
    .err { color: #e5484d; font-size: 13px; margin-top: 10px; }
  `],
  template: `
    <div class="wrap">
      <div class="title">✨ AI Coach <span class="mode" [class.basic]="mode==='basic'">{{ mode==='basic' ? '⚡ BASIC' : 'AI' }}</span></div>
      <div class="sub">Tell me what you did and I'll log it.</div>

      <textarea [(ngModel)]="text" placeholder="e.g. ran 5k in 25 min" (keydown.enter)="parse(); $event.preventDefault()"></textarea>

      @if (draft && !draft.needsClarification && draft.sport) {
        <div class="draft">
          <div class="draft-line">{{ label(draft) }}</div>
          <div class="draft-line draft-pts">+{{ draft.pointsPreview | number }} pts</div>
        </div>
        <div class="row">
          <button class="btn primary" (click)="confirm()">Confirm &amp; Log</button>
          <button class="btn ghost" (click)="draft = null">Edit</button>
        </div>
      } @else {
        @if (draft?.needsClarification) { <div class="clarify">{{ draft!.message }}</div> }
        <div class="row">
          <button class="btn primary" (click)="parse()" [disabled]="loading || !text.trim()">{{ loading ? 'Parsing…' : '✨ Parse' }}</button>
          <button class="btn ghost" (click)="close()">Cancel</button>
        </div>
      }
      @if (error) { <div class="err">{{ error }}</div> }
    </div>
  `,
})
export class AiCoachDialogComponent {
  text = '';
  draft: ParseResult | null = null;
  loading = false;
  error = '';
  mode: 'ai' | 'basic' = 'basic';

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private ref: MatDialogRef<AiCoachDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { userId: string; mode: 'ai' | 'basic' },
  ) { this.mode = data.mode; }

  label(d: ParseResult): string {
    const name = d.sport!.replace('_', ' ');
    if (d.steps != null) return `${cap(name)} · ${d.steps.toLocaleString()} steps`;
    if (d.distanceKm != null) return `${cap(name)} · ${d.distanceKm} km`;
    if (d.durationSeconds != null) return `${cap(name)} · ${mmss(d.durationSeconds)}`;
    return cap(name);
  }

  parse(): void {
    if (!this.text.trim()) return;
    this.loading = true; this.error = '';
    this.api.parseActivity(this.data.userId, this.text).subscribe({
      next: d => { this.draft = d; this.loading = false; },
      error: () => { this.error = 'Could not parse that. Try again.'; this.loading = false; },
    });
  }

  confirm(): void {
    const d = this.draft!;
    const done = (pts: number) => {
      this.snackBar.open(`Logged! +${pts} pts`, '', { duration: 2500 });
      this.ref.close(true);
    };
    if (d.sport === 'daily_steps' && d.steps != null) {
      this.api.addSteps(this.data.userId, d.steps).subscribe({
        next: () => done(d.pointsPreview),
        error: () => { this.error = 'Failed to log. Try again.'; },
      });
    } else {
      this.api.logActivity({
        userId: this.data.userId,
        datetime: new Date().toISOString(),
        sport: d.sport!,
        distance: d.distanceKm ?? undefined,
        duration: d.durationSeconds != null ? mmss(d.durationSeconds) : undefined,
        steps: undefined,
      } as any).subscribe({
        next: () => done(d.pointsPreview),
        error: () => { this.error = 'Failed to log. Try again.'; },
      });
    }
  }

  close(): void { this.ref.close(false); }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 4: Add the AI Coach entry on the dashboard**

In `frontend/src/app/dashboard/dashboard.component.ts`:

Add the import near the other imports:

```typescript
import { AiCoachDialogComponent } from './ai-coach/ai-coach-dialog.component';
```

Add a field for the mode and fetch it in `ngOnInit` (place next to the other data loads; reuse the existing `localStorage.getItem('userId')`). In the class body add:

```typescript
  aiMode: 'ai' | 'basic' = 'basic';
```

In `ngOnInit()` (or wherever the component initializes), add:

```typescript
    this.api.getAiStatus().subscribe({ next: s => this.aiMode = s.mode, error: () => {} });
```

Add the open method to the class:

```typescript
  openAiCoach(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    const ref = this.dialog.open(AiCoachDialogComponent, {
      data: { userId, mode: this.aiMode },
      width: '400px',
    });
    ref.afterClosed().subscribe(logged => { if (logged) this.loadData(); });
  }
```

Add the entry button in the template — put it directly above the Loot Boxes / vault card in the left column (after the Today's Steps widget), so it sits in the main column:

```html
            <!-- AI Coach -->
            <button class="ai-coach-card" (click)="openAiCoach()">
              <span class="ai-coach-icon">✨</span>
              <span class="ai-coach-text">
                <span class="ai-coach-title">AI COACH</span>
                <span class="ai-coach-sub">Log an activity in plain English</span>
              </span>
              <span class="ai-coach-mode" *ngIf="aiMode === 'basic'">⚡ BASIC</span>
            </button>
```

Add styles to the component `styles` array:

```css
    .ai-coach-card {
      display: flex; align-items: center; gap: 14px; width: 100%; cursor: pointer; text-align: left;
      border: 1px solid rgba(46,107,230,.25); border-radius: 18px; padding: 16px 20px;
      background: radial-gradient(120% 90% at 90% 0%, rgba(46,107,230,.10), transparent), #fff;
      box-shadow: 0 12px 26px -16px rgba(16,32,62,.35); transition: transform .1s, box-shadow .1s;
    }
    .ai-coach-card:hover { transform: translateY(-1px); box-shadow: 0 16px 30px -16px rgba(46,107,230,.5); }
    .ai-coach-icon { font-size: 26px; }
    .ai-coach-text { display: flex; flex-direction: column; }
    .ai-coach-title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .06em; color: #10203E; }
    .ai-coach-sub { font-family: 'Nunito', sans-serif; font-size: 12.5px; font-weight: 600; color: #5c6881; }
    .ai-coach-mode { margin-left: auto; font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .06em; color: #B78A00; }
```

- [ ] **Step 5: Build the frontend to confirm it compiles**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds; `dashboard-component` and the new dialog compile with no errors.

- [ ] **Step 6: Manual end-to-end verification**

With the backend running (no key needed → basic mode) and `ng serve`:
- Open the dashboard, click **AI COACH** (shows ⚡ BASIC badge with no key).
- Type "ran 5k in 25 min" → Parse → draft card shows "Running · 5 km · +500 pts" → Confirm & Log → dashboard reloads with the new activity/points.
- Type "walked 8,000 steps" → confirm → steps widget/points update (routed to the steps endpoint).
- Type "went for a run" → clarification prompt appears, no draft.
- (Optional, with `Anthropic:ApiKey` set via `dotnet user-secrets set "Anthropic:ApiKey" "sk-..."`) restart backend → badge switches to AI, and free-form phrasings like "crushed a half hour pool session" parse correctly.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/models/ai-coach.model.ts \
        frontend/src/app/shared/services/api.service.ts \
        frontend/src/app/dashboard/ai-coach/ai-coach-dialog.component.ts \
        frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat: AI Coach dashboard entry + natural-language logging dialog"
```

---

## Notes for the implementer

- **Do not auto-commit.** The user commits. The commit steps document intent; run them only if the user asks.
- **Config for a real key (optional):** `cd backend/Sport4You.Api && dotnet user-secrets init && dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."`. With no key set, everything runs in basic mode.
- **Read the claude-api skill before Task 4** to confirm the model id, endpoint, headers, and tool-use shapes; adjust the request/response handling if it differs from what's coded here.
- **Contracts untouched:** `POST /api/activities` and the steps endpoint are called as-is on confirm; the parse endpoint is purely read/interpret and never writes.
- **Frontend `logActivity` request shape** matches the existing `LogActivityRequest` model (`userId`, `datetime`, `sport`, `distance?`, `duration?`, `steps?`); duration is `mm:ss`.
