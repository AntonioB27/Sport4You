namespace Sport4You.Api.Services;

public interface IScoringService
{
    int CalculatePoints(string sport, decimal? distance, string? duration, int? steps);
}
