// backend/Sport4You.Api/Services/IAchievementService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IAchievementService
{
    Task<List<UnlockedAchievementDto>> EvaluateAchievementsAsync(Guid userId);
    Task<List<AchievementStatusDto>> GetUserAchievementsAsync(Guid userId);
}
