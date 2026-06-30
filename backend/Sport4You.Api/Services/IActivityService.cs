using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(bool IsError, string? Error, Guid ActivityId, int Points)
{
    public static ActivityResult Success(Guid id, int points) => new(false, null, id, points);
    public static ActivityResult BadRequest(string error) => new(true, error, Guid.Empty, 0);
    public static ActivityResult NotFound(string error) => new(true, error, Guid.Empty, 0);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
