using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class LeaderboardService : ILeaderboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IAvatarService _avatars;
    private readonly IBorderService _borders;
    private readonly IXpService _xp;

    public LeaderboardService(IUserRepository users, IActivityRepository activities,
        IAvatarService avatars, IBorderService borders, IXpService xp)
    {
        _users = users;
        _activities = activities;
        _avatars = avatars;
        _borders = borders;
        _xp = xp;
    }

    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync()
    {
        var users = await _users.GetAllAsync();
        var allActivities = await _activities.GetAllAsync();
        var avatarImageMap = await _avatars.GetAvatarImageMapAsync();
        var activeBorderMap = await _borders.GetActiveBorderCssMapAsync();
        var prestigeMap = await _xp.GetPrestigeLevelMapAsync();
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var oldActivities = allActivities.Where(a => a.DateTime < sevenDaysAgo).ToList();

        var currentPoints = users.ToDictionary(
            u => u.Id,
            u => allActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var previousPoints = users.ToDictionary(
            u => u.Id,
            u => oldActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var currentRanked = users
            .OrderByDescending(u => currentPoints[u.Id])
            .Select((u, i) => new { User = u, Rank = i + 1, Points = currentPoints[u.Id] })
            .ToList();

        var previousRanked = users
            .OrderByDescending(u => previousPoints[u.Id])
            .Select((u, i) => new { UserId = u.Id, Rank = i + 1 })
            .ToDictionary(x => x.UserId, x => x.Rank);

        return currentRanked.Select(c =>
        {
            avatarImageMap.TryGetValue(c.User.ActiveAvatarId ?? Guid.Empty, out var imagePath);
            activeBorderMap.TryGetValue(c.User.Id, out var borderCss);
            return new LeaderboardEntryDto
            {
                Rank = c.Rank,
                UserId = c.User.Id,
                FirstName = c.User.FirstName,
                LastName = c.User.LastName,
                TotalPoints = c.Points,
                RankTrend = previousRanked.TryGetValue(c.User.Id, out var prevRank)
                    ? prevRank - c.Rank
                    : 0,
                ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null,
                ActiveBorderCss = borderCss,
                PrestigeLevel = prestigeMap.TryGetValue(c.User.Id, out var prestige) ? prestige : 0,
            };
        }).ToList();
    }
}
