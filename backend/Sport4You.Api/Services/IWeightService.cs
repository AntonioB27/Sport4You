using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IWeightService
{
    Task<WeightHistoryDto?> GetHistoryAsync(Guid userId);
    Task<WeightEntryDto?> UpsertTodayAsync(Guid userId, decimal weightKg);
    Task<bool> SetGoalAsync(Guid userId, decimal goalKg);
}
