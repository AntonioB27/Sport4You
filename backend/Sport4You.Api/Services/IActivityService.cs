using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points,
    int XpEarned, List<CompletedMissionDto> MissionsCompleted)
{
    public static ActivityResult Success(Guid id, int points, int xpEarned, List<CompletedMissionDto> missions)
        => new(false, false, null, id, points, xpEarned, missions);

    public static ActivityResult BadRequest(string error)
        => new(true, false, error, Guid.Empty, 0, 0, []);

    public static ActivityResult NotFound(string error)
        => new(true, true, error, Guid.Empty, 0, 0, []);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
