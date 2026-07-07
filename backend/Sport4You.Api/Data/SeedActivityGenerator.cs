namespace Sport4You.Api.Data;

public record GeneratedActivity(
    int DaysAgo, int HourOffset, string Sport,
    decimal? Distance, string? Duration, int? Steps);

public static class SeedActivityGenerator
{
    private static readonly string[] Sports =
        ["running", "walking", "cycling", "swimming", "gym", "daily_steps"];

    public static GeneratedActivity Next(Random rng, int historyDays)
    {
        var sport = Sports[rng.Next(Sports.Length)];
        var daysAgo = rng.Next(0, historyDays);
        var hourOffset = rng.Next(0, 24);

        return sport switch
        {
            "running"  => new(daysAgo, hourOffset, sport, RandKm(rng, 3, 15), null, null),
            "walking"  => new(daysAgo, hourOffset, sport, RandKm(rng, 2, 8),  null, null),
            "cycling"  => new(daysAgo, hourOffset, sport, RandKm(rng, 8, 40), null, null),
            "swimming" => new(daysAgo, hourOffset, sport, null, RandDuration(rng, 15, 60), null),
            "gym"      => new(daysAgo, hourOffset, sport, null, RandDuration(rng, 30, 90), null),
            _          => new(daysAgo, hourOffset, sport, null, null, rng.Next(4000, 18001)),
        };
    }

    private static decimal RandKm(Random rng, int min, int max)
        => Math.Round((decimal)(min + rng.NextDouble() * (max - min)), 2);

    private static string RandDuration(Random rng, int minMinutes, int maxMinutes)
    {
        var minutes = rng.Next(minMinutes, maxMinutes + 1);
        var seconds = rng.Next(0, 60);
        return $"{minutes}:{seconds:D2}";
    }
}
