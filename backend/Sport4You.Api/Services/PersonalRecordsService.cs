using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class PersonalRecordsService : IPersonalRecordsService
{
    private static readonly HashSet<string> DistanceSports = new() { "running", "walking", "cycling" };
    private static readonly HashSet<string> DurationSports = new() { "swimming", "gym" };

    private readonly IActivityRepository _activities;

    public PersonalRecordsService(IActivityRepository activities)
    {
        _activities = activities;
    }

    public async Task<PersonalRecordsDto> GetRecordsAsync(Guid userId)
    {
        var activities = await _activities.GetByUserIdAsync(userId);

        var sportRecords = new List<SportRecordDto>();
        foreach (var group in activities.GroupBy(a => a.Sport))
        {
            var sport = group.Key;
            if (DistanceSports.Contains(sport))
            {
                var best = group.OrderByDescending(a => a.Distance ?? 0).First();
                sportRecords.Add(new SportRecordDto(sport, best.Distance, null, null, best.DateTime));
            }
            else if (DurationSports.Contains(sport))
            {
                var best = group.OrderByDescending(a => ParseDurationSeconds(a.Duration)).First();
                sportRecords.Add(new SportRecordDto(sport, null, best.Duration, null, best.DateTime));
            }
            else if (sport == "daily_steps")
            {
                var best = group.OrderByDescending(a => a.Steps ?? 0).First();
                sportRecords.Add(new SportRecordDto(sport, null, null, best.Steps, best.DateTime));
            }
        }

        var bestDay = activities
            .GroupBy(a => a.DateTime.Date)
            .Select(g => new { Date = g.Key, Points = g.Sum(a => a.Points) })
            .OrderByDescending(x => x.Points)
            .FirstOrDefault();

        var longestStreakEver = ActivityStreakHelper.ComputeLongestStreakEver(activities.Select(a => a.DateTime));

        return new PersonalRecordsDto(
            sportRecords,
            bestDay?.Points ?? 0,
            bestDay?.Date,
            longestStreakEver);
    }

    private static int ParseDurationSeconds(string? duration)
    {
        if (string.IsNullOrEmpty(duration)) return 0;
        var parts = duration.Split(':');
        if (parts.Length != 2) return 0;
        if (!int.TryParse(parts[0], out var minutes)) return 0;
        if (!int.TryParse(parts[1], out var seconds)) return 0;
        return minutes * 60 + seconds;
    }
}
