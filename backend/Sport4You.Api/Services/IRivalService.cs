using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record SetRivalResult(bool Success, string? Error);

public interface IRivalService
{
    Task<Guid?> GetRivalUserIdAsync(Guid userId);
    Task<SetRivalResult> SetRivalAsync(Guid userId, Guid rivalUserId);
    Task ClearRivalAsync(Guid userId);
    Task<RivalStatusDto?> GetRivalStatusAsync(Guid userId, List<LeaderboardEntryDto> leaderboard);
}
