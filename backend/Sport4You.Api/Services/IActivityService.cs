// backend/Sport4You.Api/Services/IActivityService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points,
    int XpEarned, List<CompletedMissionDto> MissionsCompleted,
    List<UnlockedAchievementDto> AchievementsUnlocked,
    List<UnlockedAvatarDto> AvatarsUnlocked)
{
    public static ActivityResult Success(
        Guid id, int points, int xpEarned,
        List<CompletedMissionDto> missions,
        List<UnlockedAchievementDto> achievements,
        List<UnlockedAvatarDto> avatars)
        => new(false, false, null, id, points, xpEarned, missions, achievements, avatars);

    public static ActivityResult BadRequest(string error)
        => new(true, false, error, Guid.Empty, 0, 0, [], [], []);

    public static ActivityResult NotFound(string error)
        => new(true, true, error, Guid.Empty, 0, 0, [], [], []);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
