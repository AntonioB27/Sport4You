using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record LevelInfo(int Level, string Title, int XpInLevel, int XpForNextLevel, int XpPercent);
public record XpSummary(int TotalXp, LevelInfo LevelInfo);
public record MissionEvaluationResult(List<CompletedMissionDto> NewlyCompleted, int XpAwarded);
public record PrestigeResult(bool Success, string? Error, XpSummary? Summary);
public record DailyMissionStatus(
    Guid Id, string Tier, string Description, int XpReward,
    bool Completed, double Progress, double ProgressMax);

public interface IXpService
{
    // Pure (no DB) — fully unit testable
    int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps);
    LevelInfo GetLevelInfo(int totalXp);

    // DB operations — added in Task 3
    Task<int> AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps);
    Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date);
    Task<XpSummary> GetXpSummaryAsync(Guid userId);
    Task<DailyMissionStatus[]> GetDailyMissionStatusAsync(Guid userId, DateOnly date);
    Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId);
    Task<int> GetPrestigeLevelAsync(Guid userId);
    Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync();
    Task<PrestigeResult> PrestigeAsync(Guid userId);
}
