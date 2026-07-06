namespace Sport4You.Api.Models;

public class Achievement
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = string.Empty;           // "bronze" | "silver" | "gold" | "platinum"
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string RequirementType { get; set; } = string.Empty;
    public double RequirementValue { get; set; }
    public string? Sport { get; set; }                          // null for cross-sport achievements
    public int XpReward { get; set; }
    public Guid? GrantsBorderId { get; set; }                   // nullable FK — only set on the Platinum achievement
}
