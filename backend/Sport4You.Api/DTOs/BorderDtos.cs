namespace Sport4You.Api.DTOs;

public record BorderStatusDto(
    Guid Id, string Name, string Rarity, string BorderCss, string ImagePath,
    bool Unlocked, DateTime? UnlockedAt, bool IsActive);

public record SetActiveBorderRequest(Guid BorderId);
