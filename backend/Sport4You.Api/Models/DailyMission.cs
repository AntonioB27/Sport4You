namespace Sport4You.Api.Models;

public class DailyMission
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = string.Empty;          // "easy" | "medium" | "hard"
    public string Description { get; set; } = string.Empty;
    public string RequirementType { get; set; } = string.Empty; // see Global Constraints
    public double RequirementValue { get; set; }
    public string? Sport { get; set; }                         // null = any sport
    public int XpReward { get; set; }                          // 75 | 150 | 300
}
