using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Sport4You.Api.Services;

public class XpService : IXpService
{
    private readonly AppDbContext _db;
    private readonly ILootBoxService _lootBox;

    public XpService(AppDbContext db, ILootBoxService lootBox)
    {
        _db = db;
        _lootBox = lootBox;
    }

    private static readonly (int Threshold, string Title)[] Levels =
    [
        (     0, "ROOKIE"),
        (   200, "JOGGER"),
        (   600, "RUNNER"),
        (  1400, "ATHLETE"),
        (  3000, "COMPETITOR"),
        (  6000, "ELITE"),
        ( 11000, "CHAMPION"),
        ( 20000, "MASTER"),
        ( 35000, "LEGEND"),
        ( 60000, "IMMORTAL"),
    ];

    public int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps)
        => sport.ToLower() switch
        {
            "running"     => (int)(distance!.Value * 20),
            "walking"     => (int)(distance!.Value * 10),
            "cycling"     => (int)(distance!.Value * 5),
            "swimming"    => ParseMinutes(duration!) * 3,
            "gym"         => ParseMinutes(duration!) * 2,
            "daily_steps" => (steps!.Value / 500),
            _             => 0,
        };

    public LevelInfo GetLevelInfo(int totalXp)
    {
        var level = 1;
        for (var i = Levels.Length - 1; i >= 0; i--)
        {
            if (totalXp >= Levels[i].Threshold) { level = i + 1; break; }
        }

        var title = Levels[level - 1].Title;
        var levelStart = Levels[level - 1].Threshold;

        if (level == Levels.Length)
            return new LevelInfo(level, title, totalXp, int.MaxValue, 100);

        var levelEnd = Levels[level].Threshold;
        var xpInLevel = totalXp - levelStart;
        var xpForNextLevel = levelEnd - levelStart;
        var xpPercent = (int)((double)xpInLevel / xpForNextLevel * 100);

        return new LevelInfo(level, title, xpInLevel, xpForNextLevel, xpPercent);
    }

    public async Task<int> AwardActivityXpAsync(
        Guid userId, Guid activityId, string sport,
        decimal? distance, string? duration, int? steps)
    {
        var baseXp = CalculateActivityXp(sport, distance, duration, steps);
        var now = DateTime.UtcNow;

        var row = await _db.UserXp.FindAsync(userId);
        var previousXp = row?.TotalXp ?? 0;
        var prestigeLevel = row?.PrestigeLevel ?? 0;
        var xpEarned = (int)(baseXp * (1 + 0.05 * prestigeLevel));
        var levelBefore = GetLevelInfo(previousXp).Level;

        if (row == null)
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xpEarned, UpdatedAt = now });
        else
        {
            row.TotalXp += xpEarned;
            row.UpdatedAt = now;
        }

        _db.XpTransactions.Add(new XpTransaction
        {
            Id = Guid.NewGuid(), UserId = userId, Source = "activity",
            SourceId = activityId, XpEarned = xpEarned, CreatedAt = now,
        });

        await _db.SaveChangesAsync();

        var levelAfter = GetLevelInfo(previousXp + xpEarned).Level;
        await AwardLevelUpBoxesAsync(userId, levelBefore, levelAfter);

        return xpEarned;
    }

    public async Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date)
    {
        var dateStr = date.ToString("yyyy-MM-dd");
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);
        var now = DateTime.UtcNow;

        var todayActivities = await _db.Activities
            .Where(a => a.UserId == userId && a.DateTime >= dayStart && a.DateTime < dayEnd)
            .ToListAsync();

        var agg = ComputeAggregates(todayActivities);

        var allMissions = await _db.DailyMissions.ToListAsync();
        var (easy, medium, hard) = SelectDailyMissions(userId, date, allMissions);
        var todayMissions = new[] { easy, medium, hard };

        var alreadyCompleted = await _db.UserMissionCompletions
            .Where(c => c.UserId == userId && c.Date == dateStr)
            .Select(c => c.MissionId)
            .ToListAsync();

        var newlyCompleted = new List<CompletedMissionDto>();
        var xpAwarded = 0;

        foreach (var mission in todayMissions)
        {
            if (alreadyCompleted.Contains(mission.Id)) continue;
            if (!EvaluateMission(mission, agg)) continue;

            _db.UserMissionCompletions.Add(new UserMissionCompletion
            {
                Id = Guid.NewGuid(), UserId = userId,
                MissionId = mission.Id, Date = dateStr, CompletedAt = now,
            });

            _db.XpTransactions.Add(new XpTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Source = "mission",
                SourceId = mission.Id, XpEarned = mission.XpReward, CreatedAt = now,
            });

            xpAwarded += mission.XpReward;
            newlyCompleted.Add(new CompletedMissionDto(mission.Description, mission.XpReward));
        }

        // Sweep bonus if all 3 now complete
        var totalCompleted = alreadyCompleted.Count + newlyCompleted.Count;
        if (totalCompleted >= 3)
        {
            var sweepAlreadyAwarded = await _db.XpTransactions.AnyAsync(
                t => t.UserId == userId && t.Source == "mission_sweep"
                     && t.CreatedAt >= dayStart && t.CreatedAt < dayEnd);

            if (!sweepAlreadyAwarded)
            {
                _db.XpTransactions.Add(new XpTransaction
                {
                    Id = Guid.NewGuid(), UserId = userId, Source = "mission_sweep",
                    SourceId = null, XpEarned = 100, CreatedAt = now,
                });
                xpAwarded += 100;
            }
        }

        var missionPreviousXp = 0;
        var missionLevelBefore = 0;

        if (xpAwarded > 0)
        {
            var row = await _db.UserXp.FindAsync(userId);
            missionPreviousXp = row?.TotalXp ?? 0;
            missionLevelBefore = GetLevelInfo(missionPreviousXp).Level;

            if (row == null)
            {
                _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xpAwarded, UpdatedAt = now });
            }
            else
            {
                row.TotalXp += xpAwarded;
                row.UpdatedAt = now;
            }
        }

        await _db.SaveChangesAsync();

        if (xpAwarded > 0)
        {
            var missionLevelAfter = GetLevelInfo(missionPreviousXp + xpAwarded).Level;
            await AwardLevelUpBoxesAsync(userId, missionLevelBefore, missionLevelAfter);
        }

        // Award one box per newly completed mission
        foreach (var _ in newlyCompleted)
            await _lootBox.EarnBoxAsync(userId, "mission");

        return new MissionEvaluationResult(newlyCompleted, xpAwarded);
    }

    public async Task<XpSummary> GetXpSummaryAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        var totalXp = row?.TotalXp ?? 0;
        return new XpSummary(totalXp, GetLevelInfo(totalXp));
    }

    public async Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date)
    {
        var dateStr = date.ToString("yyyy-MM-dd");
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        var todayActivities = await _db.Activities
            .Where(a => a.UserId == userId && a.DateTime >= dayStart && a.DateTime < dayEnd)
            .ToListAsync();

        var agg = ComputeAggregates(todayActivities);
        var allMissions = await _db.DailyMissions.ToListAsync();
        var (easy, medium, hard) = SelectDailyMissions(userId, date, allMissions);

        var completedIds = await _db.UserMissionCompletions
            .Where(c => c.UserId == userId && c.Date == dateStr)
            .Select(c => c.MissionId)
            .ToListAsync();

        return new[] { easy, medium, hard }
            .Select(m => new DailyMissionStatus(
                m.Id, m.Tier, m.Description, m.XpReward,
                completedIds.Contains(m.Id),
                GetProgress(m, agg),
                m.RequirementValue))
            .ToArray();
    }

    public async Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId)
    {
        var now = DateTime.UtcNow;
        var row = await _db.UserXp.FindAsync(userId);
        var previousXp = row?.TotalXp ?? 0;
        var levelBefore = GetLevelInfo(previousXp).Level;

        if (row == null)
            _db.UserXp.Add(new UserXp { UserId = userId, TotalXp = xp, UpdatedAt = now });
        else
        {
            row.TotalXp += xp;
            row.UpdatedAt = now;
        }

        _db.XpTransactions.Add(new XpTransaction
        {
            Id = Guid.NewGuid(), UserId = userId, Source = source,
            SourceId = sourceId, XpEarned = xp, CreatedAt = now,
        });

        await _db.SaveChangesAsync();

        var levelAfter = GetLevelInfo(previousXp + xp).Level;
        await AwardLevelUpBoxesAsync(userId, levelBefore, levelAfter);

        return xp;
    }

    public async Task<int> GetPrestigeLevelAsync(Guid userId)
        => (await _db.UserXp.FindAsync(userId))?.PrestigeLevel ?? 0;

    public async Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync()
        => await _db.UserXp.ToDictionaryAsync(x => x.UserId, x => x.PrestigeLevel);

    public async Task<PrestigeResult> PrestigeAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        var totalXp = row?.TotalXp ?? 0;
        if (GetLevelInfo(totalXp).Level < Levels.Length)
            return new PrestigeResult(false, "Reach Level 10 (IMMORTAL) before you can prestige.", null);

        if (row == null)
        {
            row = new UserXp { UserId = userId, TotalXp = 0, UpdatedAt = DateTime.UtcNow };
            _db.UserXp.Add(row);
        }
        row.TotalXp = 0;
        row.PrestigeLevel += 1;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new PrestigeResult(true, null, new XpSummary(0, GetLevelInfo(0)));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task AwardLevelUpBoxesAsync(Guid userId, int levelBefore, int levelAfter)
    {
        for (var lvl = levelBefore + 1; lvl <= levelAfter; lvl++)
            await _lootBox.EarnBoxAsync(userId, "level_up");
    }

    private record DailyAggregates(
        int TotalActivityCount,
        Dictionary<string, int> ActivityCountBySport,
        Dictionary<string, decimal> DistanceBySport,
        Dictionary<string, int> DurationMinBySport,
        int TotalSteps,
        int DistinctSportCount,
        int TotalDurationMin);

    private static DailyAggregates ComputeAggregates(IList<Activity> activities)
    {
        var countBySport = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var distBySport  = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var durBySport   = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var totalSteps = 0;
        var totalDurationMin = 0;

        foreach (var a in activities)
        {
            countBySport[a.Sport] = countBySport.GetValueOrDefault(a.Sport) + 1;

            if (a.Distance.HasValue)
                distBySport[a.Sport] = distBySport.GetValueOrDefault(a.Sport) + a.Distance.Value;

            if (a.Duration != null)
            {
                var min = ParseMinutes(a.Duration);
                durBySport[a.Sport] = durBySport.GetValueOrDefault(a.Sport) + min;
                totalDurationMin += min;
            }

            if (a.Steps.HasValue)
                totalSteps += a.Steps.Value;
        }

        return new DailyAggregates(
            activities.Count, countBySport, distBySport,
            durBySport, totalSteps, countBySport.Keys.Count, totalDurationMin);
    }

    private static bool EvaluateMission(DailyMission mission, DailyAggregates agg)
    {
        var req = mission.RequirementValue;
        var sport = mission.Sport?.ToLower();
        return mission.RequirementType switch
        {
            "activity_count" => sport == null
                ? agg.TotalActivityCount >= req
                : agg.ActivityCountBySport.GetValueOrDefault(sport) >= req,
            "distance_km" => sport != null &&
                (double)agg.DistanceBySport.GetValueOrDefault(sport) >= req,
            "duration_min" => sport != null &&
                agg.DurationMinBySport.GetValueOrDefault(sport) >= req,
            "steps"       => agg.TotalSteps >= req,
            "total_min"   => agg.TotalDurationMin >= req,
            "sport_count" => agg.DistinctSportCount >= req,
            _ => false,
        };
    }

    private static double GetProgress(DailyMission mission, DailyAggregates agg)
    {
        var sport = mission.Sport?.ToLower();
        return mission.RequirementType switch
        {
            "activity_count" => sport == null
                ? agg.TotalActivityCount
                : agg.ActivityCountBySport.GetValueOrDefault(sport),
            "distance_km" => sport != null
                ? (double)agg.DistanceBySport.GetValueOrDefault(sport) : 0,
            "duration_min" => sport != null
                ? agg.DurationMinBySport.GetValueOrDefault(sport) : 0,
            "steps"       => agg.TotalSteps,
            "total_min"   => agg.TotalDurationMin,
            "sport_count" => agg.DistinctSportCount,
            _ => 0,
        };
    }

    private static (DailyMission Easy, DailyMission Medium, DailyMission Hard) SelectDailyMissions(
        Guid userId, DateOnly date, IList<DailyMission> allMissions)
    {
        var seed = StableSeed(userId, date);
        var rng = new Random(seed);

        var easyPool   = allMissions.Where(m => m.Tier == "easy").ToList();
        var mediumPool = allMissions.Where(m => m.Tier == "medium").ToList();
        var hardPool   = allMissions.Where(m => m.Tier == "hard").ToList();

        return (easyPool[rng.Next(easyPool.Count)],
                mediumPool[rng.Next(mediumPool.Count)],
                hardPool[rng.Next(hardPool.Count)]);
    }

    private static int StableSeed(Guid userId, DateOnly date)
    {
        // FNV-1a hash — stable across .NET runtime restarts (unlike string.GetHashCode)
        var input = $"{userId:N}{date:yyyy-MM-dd}";
        var hash = 2166136261u;
        foreach (var c in input) { hash ^= c; hash *= 16777619; }
        return (int)(hash & 0x7FFFFFFF);
    }

    private static int ParseMinutes(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length >= 1 && int.TryParse(parts[0], out var min) ? min : 0;
    }
}
