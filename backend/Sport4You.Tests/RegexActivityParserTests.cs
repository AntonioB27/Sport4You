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

    [Fact]
    public async Task SwimWithMeterDistance_DoesNotMisreadAsMinutes()
    {
        var r = await _sut.ParseAsync("swam 1500m today");
        Assert.Equal("swimming", r.Sport);
        Assert.True(r.NeedsClarification);
        Assert.Null(r.DurationSeconds);
    }

    [Fact]
    public async Task HourPlusUnrelatedMeterDistance_DoesNotMisreadMetersAsMinutes()
    {
        var r = await _sut.ParseAsync("swam for 1h, covered 1500m");
        Assert.Equal("swimming", r.Sport);
        Assert.True(r.NeedsClarification);
        Assert.Null(r.DurationSeconds);
    }
}
