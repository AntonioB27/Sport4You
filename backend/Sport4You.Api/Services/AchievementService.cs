// backend/Sport4You.Api/Services/AchievementService.cs
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class AchievementService : IAchievementService
{
    private readonly AppDbContext _db;
    private readonly IXpService _xp;

    public AchievementService(AppDbContext db, IXpService xp)
    {
        _db = db;
        _xp = xp;
    }

    public async Task<List<AchievementStatusDto>> GetUserAchievementsAsync(Guid userId)
    {
        var all = await _db.Achievements.ToListAsync();
        var earned = await _db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
        var earnedMap = earned.ToDictionary(ua => ua.AchievementId);

        var agg = await ComputeAggregatesAsync(userId);

        var totalUsers = await _db.Users.CountAsync();
        var ownersByAchievement = await _db.UserAchievements
            .GroupBy(ua => ua.AchievementId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        return all.Select(a =>
        {
            earnedMap.TryGetValue(a.Id, out var ua);
            var owners = ownersByAchievement.GetValueOrDefault(a.Id);
            var ownedByPercent = totalUsers == 0 ? 0
                : (int)Math.Round(100.0 * owners / totalUsers);
            return new AchievementStatusDto(
                a.Id, a.Tier, a.Name, a.Description, a.RequirementType,
                a.XpReward, ua != null, ua?.UnlockedAt,
                a.Sport, a.RequirementValue, ComputeProgress(a, agg), ownedByPercent);
        }).ToList();
    }

    public async Task<List<UnlockedAchievementDto>> EvaluateAchievementsAsync(Guid userId)
    {
        // Load unearned achievements
        var earnedIds = await _db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();

        var unearned = await _db.Achievements
            .Where(a => !earnedIds.Contains(a.Id))
            .ToListAsync();

        if (unearned.Count == 0) return [];

        var agg = await ComputeAggregatesAsync(userId);

        // Evaluate + batch-save
        var toUnlock = new List<Achievement>();
        foreach (var a in unearned)
        {
            if (!KnownRequirementTypes.Contains(a.RequirementType)) continue;
            var progress = ComputeProgress(a, agg);
            var meets = a.RequirementType == "leaderboard_rank"
                ? progress <= a.RequirementValue
                : progress >= a.RequirementValue;
            if (meets) toUnlock.Add(a);
        }

        if (toUnlock.Count == 0) return [];

        var now = DateTime.UtcNow;
        var totalXpToAward = 0;
        var result = new List<UnlockedAchievementDto>();

        // Batch XP update inline rather than calling AwardGenericXpAsync per achievement —
        // one SaveChangesAsync flush for all unlocked rows instead of N separate calls.
        foreach (var a in toUnlock)
        {
            _db.UserAchievements.Add(new UserAchievement
            {
                UserId = userId, AchievementId = a.Id, UnlockedAt = now,
            });
            _db.XpTransactions.Add(new XpTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Source = "achievement",
                SourceId = a.Id, XpEarned = a.XpReward, CreatedAt = now,
            });
            totalXpToAward += a.XpReward;
            result.Add(new UnlockedAchievementDto(a.Id, a.Tier, a.Name, a.Description, a.XpReward));
        }

        // Update UserXp in one shot
        var row = await _db.UserXp.FindAsync(userId);
        if (row == null)
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = totalXpToAward, UpdatedAt = now });
        else
        {
            row.TotalXp += totalXpToAward;
            row.UpdatedAt = now;
        }

        await _db.SaveChangesAsync();
        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private sealed record UserAggregates(
        Dictionary<string, double> KmBySport,
        Dictionary<string, int> MinBySport,
        int TotalSteps,
        int DistinctSports,
        int MaxPointsInDay,
        int Streak,
        int Level,
        int Rank,
        bool HasMission,
        bool HasSweep,
        int ActivityCount);

    private static readonly HashSet<string> KnownRequirementTypes =
    [
        "total_km", "total_minutes", "total_steps", "streak_days",
        "level_reached", "leaderboard_rank", "first_activity",
        "first_mission", "first_sweep", "all_sports", "points_in_day",
    ];

    private async Task<UserAggregates> ComputeAggregatesAsync(Guid userId)
    {
        var allActivities = await _db.Activities
            .Where(a => a.UserId == userId)
            .ToListAsync();

        var totalKmBySport = allActivities
            .Where(a => a.Distance.HasValue)
            .GroupBy(a => a.Sport.ToLower())
            .ToDictionary(g => g.Key, g => (double)g.Sum(a => a.Distance!.Value));

        var totalMinBySport = allActivities
            .Where(a => a.Duration != null)
            .GroupBy(a => a.Sport.ToLower())
            .ToDictionary(g => g.Key, g => g.Sum(a => ParseMinutes(a.Duration!)));

        var totalSteps = allActivities.Sum(a => a.Steps ?? 0);
        var distinctSports = allActivities.Select(a => a.Sport.ToLower()).Distinct().Count();
        var maxPointsInDay = allActivities.Count == 0 ? 0
            : allActivities
                .GroupBy(a => DateOnly.FromDateTime(a.DateTime.ToUniversalTime()))
                .Select(g => g.Sum(a => a.Points))
                .Max();

        var streak = ActivityStreakHelper.ComputeCurrentStreak(allActivities.Select(a => a.DateTime));

        var xpRow = await _db.UserXp.FindAsync(userId);
        var level = _xp.GetLevelInfo(xpRow?.TotalXp ?? 0).Level;

        var allUserPoints = await _db.Activities
            .GroupBy(a => a.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(a => a.Points) })
            .OrderByDescending(x => x.Total)
            .ToListAsync();
        var myIdx = allUserPoints.FindIndex(x => x.UserId == userId);
        var rank = myIdx >= 0 ? myIdx + 1 : allUserPoints.Count + 1;

        var hasMission = await _db.UserMissionCompletions.AnyAsync(c => c.UserId == userId);
        var hasSweep = await _db.XpTransactions
            .AnyAsync(t => t.UserId == userId && t.Source == "mission_sweep");

        return new UserAggregates(
            totalKmBySport, totalMinBySport, totalSteps, distinctSports,
            maxPointsInDay, streak, level, rank, hasMission, hasSweep,
            allActivities.Count);
    }

    // For leaderboard_rank, progress is the user's current rank (lower is better);
    // every other type counts up toward RequirementValue.
    private static double ComputeProgress(Achievement a, UserAggregates agg)
    {
        var sport = a.Sport?.ToLower();
        return a.RequirementType switch
        {
            "total_km"         => sport != null ? agg.KmBySport.GetValueOrDefault(sport) : 0,
            "total_minutes"    => sport != null ? agg.MinBySport.GetValueOrDefault(sport) : 0,
            "total_steps"      => agg.TotalSteps,
            "streak_days"      => agg.Streak,
            "level_reached"    => agg.Level,
            "leaderboard_rank" => agg.Rank,
            "first_activity"   => agg.ActivityCount,
            "first_mission"    => agg.HasMission ? 1 : 0,
            "first_sweep"      => agg.HasSweep ? 1 : 0,
            "all_sports"       => agg.DistinctSports,
            "points_in_day"    => agg.MaxPointsInDay,
            _                  => 0,
        };
    }

    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
