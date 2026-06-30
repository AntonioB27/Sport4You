using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ScoringServiceTests
{
    private readonly ScoringService _sut = new();

    [Theory]
    [InlineData(1.0, 100)]
    [InlineData(5.0, 500)]
    [InlineData(42.195, 4219)]  // floor(42.195 * 100) = floor(4219.5) = 4219
    [InlineData(0.005, 0)]      // floor(0.5) = 0
    public void Running_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("running", distance, null, null));

    [Theory]
    [InlineData(1.0, 50)]
    [InlineData(1.55, 77)]   // floor(1.55 * 50) = floor(77.5) = 77
    [InlineData(0.01, 0)]    // floor(0.5) = 0
    public void Walking_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("walking", distance, null, null));

    [Theory]
    [InlineData(1.0, 25)]
    [InlineData(2.5, 62)]    // floor(2.5 * 25) = floor(62.5) = 62
    [InlineData(0.01, 0)]
    public void Cycling_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("cycling", distance, null, null));

    [Theory]
    [InlineData("1:00", 15)]
    [InlineData("1:55", 15)]  // 1 full minute only; seconds discarded
    [InlineData("0:59", 0)]   // 0 full minutes
    [InlineData("10:00", 150)]
    [InlineData("0:00", 0)]
    public void Swimming_ReturnsCorrectPoints(string duration, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("swimming", null, duration, null));

    [Theory]
    [InlineData("1:00", 5)]
    [InlineData("1:55", 5)]   // 1 full minute only
    [InlineData("0:59", 0)]   // 0 full minutes
    [InlineData("10:00", 50)]
    public void Gym_ReturnsCorrectPoints(string duration, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("gym", null, duration, null));

    [Theory]
    [InlineData(100, 1)]
    [InlineData(399, 3)]    // floor(399/100) = 3
    [InlineData(99, 0)]     // floor(99/100) = 0
    [InlineData(1000, 10)]
    [InlineData(10000, 100)]
    public void DailySteps_ReturnsCorrectPoints(int steps, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("daily_steps", null, null, steps));

    [Fact]
    public void MalformedDuration_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => _sut.CalculatePoints("swimming", null, "90", null));
    }

    [Fact]
    public void NullDistance_ForRunning_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => _sut.CalculatePoints("running", null, null, null));
    }
}
