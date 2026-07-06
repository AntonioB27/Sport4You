using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface ILeaderboardService
{
    Task<List<LeaderboardEntryDto>> GetLeaderboardAsync(string period = "all", string sport = "all");
}
