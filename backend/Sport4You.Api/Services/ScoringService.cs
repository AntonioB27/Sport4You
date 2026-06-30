namespace Sport4You.Api.Services;

public class ScoringService : IScoringService
{
    public int CalculatePoints(string sport, decimal? distance, string? duration, int? steps)
    {
        return sport switch
        {
            "running"      => (int)(distance!.Value * 100),
            "walking"      => (int)(distance!.Value * 50),
            "cycling"      => (int)(distance!.Value * 25),
            "swimming"     => ParseMinutes(duration!) * 15,
            "gym"          => ParseMinutes(duration!) * 5,
            "daily_steps"  => steps!.Value / 100,
            _              => throw new ArgumentException($"Unknown sport: {sport}")
        };
    }

    private static int ParseMinutes(string duration)
    {
        var colonIndex = duration.IndexOf(':');
        return int.Parse(duration[..colonIndex]);
    }
}
