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

    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync(string period = "all", string sport = "all")
    {
        var users = await _users.GetAllAsync();
        var allActivities = await _activities.GetAllAsync();
        var avatarImageMap = await _avatars.GetAvatarImageMapAsync();
        var activeBorderMap = await _borders.GetActiveBorderCssMapAsync();
        var prestigeMap = await _xp.GetPrestigeLevelMapAsync();
        var now = DateTime.UtcNow;

        var scopedActivities = sport == "all"
            ? allActivities
            : allActivities.Where(a => a.Sport == sport).ToList();

        // Activities that count toward the ranking shown to the caller.
        var currentActivities = period switch
        {
            "7d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-7)).ToList(),
            "30d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-30)).ToList(),
            _ => scopedActivities, // "all"
        };

        // Activities used only to compute RankTrend (the prior comparison window).
        // period=all keeps the exact pre-existing convention: "points as they stood
        // before the last 7 days" vs. the true all-time total.
        var previousActivities = period switch
        {
            "7d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-14) && a.DateTime < now.AddDays(-7)).ToList(),
            "30d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-60) && a.DateTime < now.AddDays(-30)).ToList(),
            _ => scopedActivities.Where(a => a.DateTime < now.AddDays(-7)).ToList(), // "all"
        };

        var isFiltered = period != "all" || sport != "all";

        var currentPoints = users.ToDictionary(
            u => u.Id,
            u => currentActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var previousPoints = users.ToDictionary(
            u => u.Id,
            u => previousActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        // On the default view every user appears, even at 0 points (unchanged from
        // today). Under any active filter, 0-point users are dropped entirely.
        var eligibleUsers = isFiltered
            ? users.Where(u => currentPoints[u.Id] > 0).ToList()
            : users;

        var currentRanked = eligibleUsers
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

            // A user with no activity at all in the previous comparison window has no
            // meaningful prior rank to compare against — only applies to the new 7d/30d
            // windows; period=all's trend behavior is intentionally left untouched.
            var noPriorData = period != "all" && previousPoints[c.User.Id] == 0;

            return new LeaderboardEntryDto
            {
                Rank = c.Rank,
                UserId = c.User.Id,
                FirstName = c.User.FirstName,
                LastName = c.User.LastName,
                TotalPoints = c.Points,
                RankTrend = !noPriorData && previousRanked.TryGetValue(c.User.Id, out var prevRank)
                    ? prevRank - c.Rank
                    : 0,
                ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null,
                ActiveBorderCss = borderCss,
                PrestigeLevel = prestigeMap.TryGetValue(c.User.Id, out var prestige) ? prestige : 0,
            };
        }).ToList();
    }
}
