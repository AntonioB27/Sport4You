// backend/Sport4You.Api/Services/IAvatarService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IAvatarService
{
    Task<List<UnlockedAvatarDto>> EvaluateAvatarsAsync(Guid userId);
    Task<List<AvatarStatusDto>> GetUserAvatarsAsync(Guid userId);
    Task<bool> SetActiveAvatarAsync(Guid userId, Guid avatarId);
    Task<AvatarStatusDto?> GetActiveAvatarAsync(Guid userId);
    Task UnlockAndEquipDefaultAsync(Guid userId);
}
