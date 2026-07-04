using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface ILootBoxService
{
    Task EarnBoxAsync(Guid userId, string reason);
    Task<OpenBoxResultDto> OpenBoxAsync(Guid userId);
    Task<int> GetPendingCountAsync(Guid userId);
}
