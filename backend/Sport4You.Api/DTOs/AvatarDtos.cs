// backend/Sport4You.Api/DTOs/AvatarDtos.cs
namespace Sport4You.Api.DTOs;

public record UnlockedAvatarDto(Guid Id, string Name, string Description, string ImagePath);

public record AvatarStatusDto(
    Guid Id, string Name, string Description, string ImagePath,
    string UnlockType,
    bool Unlocked, DateTime? UnlockedAt, bool IsActive);

public record SetActiveAvatarRequest(Guid AvatarId);
