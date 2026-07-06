using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ActivityStreakHelperTests
{
    [Fact]
    public void ComputeLongestStreakEver_NoActivities_ReturnsZero()
    {
        var result = ActivityStreakHelper.ComputeLongestStreakEver(new List<DateTime>());
        Assert.Equal(0, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_SingleDay_ReturnsOne()
    {
        var dates = new List<DateTime> { new DateTime(2026, 1, 1) };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(1, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_HistoricalStreakLongerThanCurrent_ReturnsHistoricalMax()
    {
        // A 5-day streak in the past (Jan 1-5), then a gap, then a 2-day
        // streak ending "today" (Jan 20). The longest-ever streak (5) must
        // beat the current active streak (2) — proves this isn't just
        // reusing ComputeCurrentStreak's early-exit behavior.
        var today = DateTime.UtcNow.Date;
        var dates = new List<DateTime>
        {
            new DateTime(2026, 1, 1), new DateTime(2026, 1, 2), new DateTime(2026, 1, 3),
            new DateTime(2026, 1, 4), new DateTime(2026, 1, 5),
            today.AddDays(-1), today,
        };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(5, result);
    }

    [Fact]
    public void ComputeLongestStreakEver_MultipleActivitiesSameDay_CountsDayOnce()
    {
        var dates = new List<DateTime>
        {
            new DateTime(2026, 1, 1, 8, 0, 0), new DateTime(2026, 1, 1, 18, 0, 0),
            new DateTime(2026, 1, 2, 9, 0, 0),
        };
        var result = ActivityStreakHelper.ComputeLongestStreakEver(dates);
        Assert.Equal(2, result);
    }
}
