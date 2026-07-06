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
        // First try to match the classic "Xh Ym" pattern (hours and bare mins adjacent)
        var hoursAndBareMins = Regex.Match(t, @"(\d+)\s*h(?:our|r)?s?\s+(\d+)\s*m\b");

        if (hoursAndBareMins.Success)
        {
            int h = int.Parse(hoursAndBareMins.Groups[1].Value);
            int m = int.Parse(hoursAndBareMins.Groups[2].Value);
            return h * 3600 + m * 60;
        }

        // Check for standalone patterns independently
        var hours = Regex.Match(t, @"(\d+)\s*h(?:our|r)?s?\b");
        var mins = Regex.Match(t, @"(\d+)\s*min(?:ute)?s?\b");

        // If hours found but no explicit minutes, check for bare "m" anywhere
        // If bare "m" exists elsewhere, it's ambiguous (distance vs duration), so clarify
        if (hours.Success && !mins.Success)
        {
            var bareM = Regex.IsMatch(t, @"(\d+)\s*m\b");
            if (bareM)
            {
                return null; // Ambiguous: bare "m" found but not adjacent to hours
            }
        }

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
