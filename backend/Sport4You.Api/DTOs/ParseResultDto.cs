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
