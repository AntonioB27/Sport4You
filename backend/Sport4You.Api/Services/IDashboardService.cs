using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IDashboardService
{
    Task<DashboardDto?> GetDashboardAsync(Guid userId);
}
