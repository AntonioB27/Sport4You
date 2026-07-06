namespace Sport4You.Api.DTOs;

public record ShopBoosterDto(int Price, int BoostedActivities, double Multiplier);
public record ShopLootBoxDto(string Tier, int Price, int CommonPct, int RarePct, int LegendaryPct);
public record ShopAvatarDto(Guid Id, string Name, string Description, string ImagePath, string Rarity, int Price, bool Owned);

public record ShopCatalogDto(
    int Coins,
    int BoostedActivitiesRemaining,
    ShopBoosterDto Booster,
    List<ShopLootBoxDto> LootBoxes,
    List<ShopAvatarDto> Avatars);

public record BoosterPurchaseResult(bool Success, string? Error, int Coins, int BoostedActivitiesRemaining);
public record LootBoxPurchaseResult(bool Success, string? Error, int Coins, int PendingBoxes);
public record AvatarPurchaseResult(bool Success, string? Error, int Coins);

public record PurchaseLootBoxRequest(string Tier);
public record PurchaseAvatarRequest(Guid AvatarId);
