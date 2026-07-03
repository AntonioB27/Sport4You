namespace Sport4You.Api.Models;

public class LootBoxReward
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;    // "avatar" | "border"
    public string Rarity { get; set; } = string.Empty;  // "common" | "rare" | "legendary"
    public string Name { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
    public Guid? AvatarId { get; set; }
    public Guid? BorderId { get; set; }
}
