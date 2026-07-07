using Sport4You.Api.Data;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class SeedActivityGeneratorTests
{
    [Fact]
    public void Next_ProducesValidSportMetricPairs_ScoringNeverThrows()
    {
        var rng = new Random(123);
        var scoring = new ScoringService();
        for (var i = 0; i < 500; i++)
        {
            var g = SeedActivityGenerator.Next(rng, 90);
            // Must not throw — proves sport/metric pairing is always valid.
            var points = scoring.CalculatePoints(g.Sport, g.Distance, g.Duration, g.Steps);
            Assert.True(points >= 0);
        }
    }

    [Fact]
    public void Next_DaysAgo_WithinWindow()
    {
        var rng = new Random(7);
        for (var i = 0; i < 500; i++)
        {
            var g = SeedActivityGenerator.Next(rng, 90);
            Assert.InRange(g.DaysAgo, 0, 89);
            Assert.InRange(g.HourOffset, 0, 23);
        }
    }

    [Fact]
    public void Next_SetsOnlyTheMetricForItsSport()
    {
        var rng = new Random(42);
        for (var i = 0; i < 500; i++)
        {
            var g = SeedActivityGenerator.Next(rng, 90);
            switch (g.Sport)
            {
                case "running": case "walking": case "cycling":
                    Assert.NotNull(g.Distance); Assert.Null(g.Duration); Assert.Null(g.Steps); break;
                case "swimming": case "gym":
                    Assert.Null(g.Distance); Assert.NotNull(g.Duration); Assert.Null(g.Steps); break;
                case "daily_steps":
                    Assert.Null(g.Distance); Assert.Null(g.Duration); Assert.NotNull(g.Steps); break;
                default:
                    Assert.Fail($"Unexpected sport {g.Sport}"); break;
            }
        }
    }

    [Fact]
    public void Next_OverManyDraws_ProducesAllSixSports()
    {
        var rng = new Random(99);
        var seen = new HashSet<string>();
        for (var i = 0; i < 1000; i++) seen.Add(SeedActivityGenerator.Next(rng, 90).Sport);
        Assert.Equal(6, seen.Count);
    }
}
