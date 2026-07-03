namespace Sport4You.Api.DTOs;

public record UnlockedAchievementDto(Guid Id, string Tier, string Name, string Description, int XpReward);
public record AchievementStatusDto(
    Guid Id, string Tier, string Name, string Description,
    string RequirementType, int XpReward, bool Unlocked, DateTime? UnlockedAt,
    string? Sport, double RequirementValue, double Progress, int OwnedByPercent);

public record AchievementsPageDto(XpDto Xp, List<AchievementStatusDto> Achievements);
