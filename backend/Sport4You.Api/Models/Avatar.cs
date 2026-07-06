namespace Sport4You.Api.Models;

public class Avatar
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string UnlockType { get; set; } = string.Empty;   // "default"|"level_reached"|"achievement_earned"|"streak_days"|"activities_logged"|"loot_box"|"shop"
    public double UnlockValue { get; set; }                  // 0 for "default", "achievement_earned", and "shop"
    public Guid? UnlockAchievementId { get; set; }           // nullable FK — only set when UnlockType == "achievement_earned"
    public string ImagePath { get; set; } = string.Empty;    // e.g. "assets/avatars/starter-sporty.png"
    public string? ShopRarity { get; set; }                  // "common" | "rare" | "legendary" — shop avatars only
    public int? ShopPrice { get; set; }                      // coin price — shop avatars only
}
