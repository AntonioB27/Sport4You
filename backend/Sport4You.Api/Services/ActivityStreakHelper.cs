// backend/Sport4You.Api/Services/ActivityStreakHelper.cs
namespace Sport4You.Api.Services;

internal static class ActivityStreakHelper
{
    internal static int ComputeCurrentStreak(IEnumerable<DateTime> activityDateTimes)
    {
        var dates = activityDateTimes
            .Select(d => DateOnly.FromDateTime(d.ToUniversalTime()))
            .Distinct()
            .OrderByDescending(d => d)
            .ToList();

        if (dates.Count == 0) return 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (dates[0] != today && dates[0] != today.AddDays(-1)) return 0;

        var streak = 0;
        var expected = dates[0];
        foreach (var date in dates)
        {
            if (date == expected) { streak++; expected = expected.AddDays(-1); }
            else break;
        }
        return streak;
    }
}
