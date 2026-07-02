namespace Sport4You.Api.DTOs;

public record UnlockedAchievementDto(Guid Id, string Tier, string Name, string Description, int XpReward);
public record AchievementStatusDto(
    Guid Id, string Tier, string Name, string Description,
    string RequirementType, int XpReward, bool Unlocked, DateTime? UnlockedAt);
