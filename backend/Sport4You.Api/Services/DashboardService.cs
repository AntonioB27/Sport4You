using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IXpService _xp;

    public DashboardService(IUserRepository users, IActivityRepository activities, IXpService xp)
    {
        _users = users;
        _activities = activities;
        _xp = xp;
    }

    public async Task<DashboardDto?> GetDashboardAsync(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        var activities = await _activities.GetByUserIdAsync(userId);
        var xpSummary = await _xp.GetXpSummaryAsync(userId);
        var missionStatuses = await _xp.GetDailyMissionStatusAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow));

        var pointsOverTime = activities
            .GroupBy(a => a.DateTime.Date)
            .Select(g => new PointsOverTimeDto
            {
                Date = g.Key.ToString("yyyy-MM-dd"),
                Points = g.Sum(a => a.Points)
            })
            .OrderBy(x => x.Date)
            .ToList();

        var sportBreakdown = activities
            .GroupBy(a => a.Sport)
            .Select(g => new SportBreakdownDto
            {
                Sport = g.Key,
                Points = g.Sum(a => a.Points)
            })
            .ToList();

        var xpDto = new XpDto(
            xpSummary.TotalXp,
            xpSummary.LevelInfo.Level,
            xpSummary.LevelInfo.Title,
            xpSummary.LevelInfo.XpInLevel,
            xpSummary.LevelInfo.XpForNextLevel,
            xpSummary.LevelInfo.XpPercent);

        var missionDtos = missionStatuses.Select(m => new DailyMissionDto(
            m.Id, m.Tier, m.Description, m.XpReward,
            m.Completed, m.Progress, m.ProgressMax)).ToList();

        return new DashboardDto
        {
            User = new UserInfoDto { FirstName = user.FirstName, LastName = user.LastName },
            TotalPoints = activities.Sum(a => a.Points),
            Activities = activities.Select(a => new ActivityDto
            {
                Id = a.Id,
                DateTime = a.DateTime.ToString("o"),
                Sport = a.Sport,
                Distance = a.Distance,
                Duration = a.Duration,
                Steps = a.Steps,
                Points = a.Points
            }).ToList(),
            PointsOverTime = pointsOverTime,
            SportBreakdown = sportBreakdown,
            Xp = xpDto,
            DailyMissions = missionDtos
        };
    }
}
