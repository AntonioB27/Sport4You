using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IBorderService
{
    Task<List<BorderStatusDto>> GetUserBordersAsync(Guid userId);
    Task<bool> SetActiveBorderAsync(Guid userId, Guid borderId);
    Task<Dictionary<Guid, string>> GetActiveBorderCssMapAsync();
}
