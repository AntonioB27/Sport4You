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

        return all.Select(a =>
        {
            earnedMap.TryGetValue(a.Id, out var ua);
            return new AchievementStatusDto(
                a.Id, a.Tier, a.Name, a.Description, a.RequirementType,
                a.XpReward, ua != null, ua?.UnlockedAt);
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

        // Compute all-time aggregates
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

        var streak = ComputeCurrentStreak(allActivities.Select(a => a.DateTime));

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

        // Evaluate + batch-save
        var toUnlock = new List<Achievement>();
        foreach (var a in unearned)
        {
            var sport = a.Sport?.ToLower();
            bool meets = a.RequirementType switch
            {
                "total_km"         => sport != null && totalKmBySport.GetValueOrDefault(sport) >= a.RequirementValue,
                "total_minutes"    => sport != null && totalMinBySport.GetValueOrDefault(sport) >= a.RequirementValue,
                "total_steps"      => totalSteps >= a.RequirementValue,
                "streak_days"      => streak >= a.RequirementValue,
                "level_reached"    => level >= a.RequirementValue,
                "leaderboard_rank" => rank <= a.RequirementValue,
                "first_activity"   => allActivities.Count >= a.RequirementValue,
                "first_mission"    => hasMission,
                "first_sweep"      => hasSweep,
                "all_sports"       => distinctSports >= a.RequirementValue,
                "points_in_day"    => maxPointsInDay >= a.RequirementValue,
                _                  => false,
            };
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

    private static int ComputeCurrentStreak(IEnumerable<DateTime> activityDateTimes)
    {
        var dates = activityDateTimes
            .Select(d => DateOnly.FromDateTime(d.ToUniversalTime()))
            .Distinct()
            .OrderByDescending(d => d)
            .ToList();

        if (dates.Count == 0) return 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Streak must end today or yesterday (activity just logged = today)
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

    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
