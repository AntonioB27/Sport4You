namespace Sport4You.Api.Services;

public class ScoringService : IScoringService
{
    public int CalculatePoints(string sport, decimal? distance, string? duration, int? steps)
    {
        var validationError = sport switch
        {
            "running" or "walking" or "cycling" when distance is null => $"{sport} requires distance",
            "gym" or "swimming" when duration is null => $"{sport} requires duration",
            "daily_steps" when steps is null => "daily_steps requires steps",
            _ => null
        };
        if (validationError != null) throw new ArgumentException(validationError);

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
        if (colonIndex < 0) throw new ArgumentException($"Duration must be in mm:ss format, got: {duration}");
        return int.Parse(duration[..colonIndex]);
    }
}
