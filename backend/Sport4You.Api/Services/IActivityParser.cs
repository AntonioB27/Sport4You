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
