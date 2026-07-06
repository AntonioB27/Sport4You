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
