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
