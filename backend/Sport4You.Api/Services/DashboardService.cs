// backend/Sport4You.Api/Services/DashboardService.cs
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IXpService _xp;
    private readonly IAchievementService _achievements;
    private readonly IAvatarService _avatars;
    private readonly ILeaderboardService _leaderboard;
    private readonly IBorderService _borders;
    private readonly IRivalService _rivals;
    private readonly IShopService _shop;

    public DashboardService(
        IUserRepository users, IActivityRepository activities,
        IXpService xp, IAchievementService achievements,
        IAvatarService avatars, ILeaderboardService leaderboard,
        IBorderService borders, IRivalService rivals, IShopService shop)
    {
        _users = users;
        _activities = activities;
        _xp = xp;
        _achievements = achievements;
        _avatars = avatars;
        _leaderboard = leaderboard;
        _borders = borders;
        _rivals = rivals;
        _shop = shop;
    }

    public async Task<DashboardDto?> GetDashboardAsync(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        var activities = await _activities.GetByUserIdAsync(userId);
        var xpSummary = await _xp.GetXpSummaryAsync(userId);
        var prestigeLevel = await _xp.GetPrestigeLevelAsync(userId);
        var missionStatuses = await _xp.GetDailyMissionStatusAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow));
        var allAchievements = await _achievements.GetUserAchievementsAsync(userId);
        var recentAchievements = allAchievements
            .Where(a => a.Unlocked)
            .OrderByDescending(a => a.UnlockedAt)
            .Take(6)
            .ToList();
        var activeAvatar = await _avatars.GetActiveAvatarAsync(userId);
        var activeBorderCss = await _borders.GetActiveBorderCssAsync(userId);
        var leaderboard = await _leaderboard.GetLeaderboardAsync();
        var leaderboardEntry = leaderboard.FirstOrDefault(e => e.UserId == userId);
        var rivalStatus = await _rivals.GetRivalStatusAsync(userId, leaderboard);
        var (coins, boostedActivitiesRemaining) = await _shop.GetBalanceAsync(userId);

        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        var todaySteps = activities
            .Where(a => a.Sport == "daily_steps" && a.DateTime >= todayStart && a.DateTime < todayEnd)
            .Sum(a => a.Steps ?? 0);

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
            xpSummary.LevelInfo.XpPercent,
            prestigeLevel);

        var missionDtos = missionStatuses.Select(m => new DailyMissionDto(
            m.Id, m.Tier, m.Description, m.XpReward,
            m.Completed, m.Progress, m.ProgressMax)).ToList();

        return new DashboardDto
        {
            User = new UserInfoDto { FirstName = user.FirstName, LastName = user.LastName },
            TotalPoints = activities.Sum(a => a.Points),
            Rank = leaderboardEntry?.Rank ?? 0,
            CurrentStreak = ActivityStreakHelper.ComputeCurrentStreak(activities.Select(a => a.DateTime)),
            TodaySteps = todaySteps,
            Coins = coins,
            BoostedActivitiesRemaining = boostedActivitiesRemaining,
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
            DailyMissions = missionDtos,
            RecentAchievements = recentAchievements,
            ActiveAvatar = activeAvatar,
            ActiveBorderCss = activeBorderCss,
            RivalStatus = rivalStatus,
        };
    }
}
