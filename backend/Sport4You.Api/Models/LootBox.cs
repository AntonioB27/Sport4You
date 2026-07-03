namespace Sport4You.Api.Models;

public class LootBox
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string EarnReason { get; set; } = string.Empty; // "level_up" | "streak" | "mission"
    public DateTime EarnedAt { get; set; }
    public DateTime? OpenedAt { get; set; }
    public Guid? RewardId { get; set; }
    public bool WasDuplicate { get; set; }
    public int DuplicateXpAwarded { get; set; }
}
