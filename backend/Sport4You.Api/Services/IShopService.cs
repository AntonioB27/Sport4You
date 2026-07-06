using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IShopService
{
    Task AddCoinsAsync(Guid userId, int coinsEarned);
    Task<(int Coins, int BoostedActivitiesRemaining)> GetBalanceAsync(Guid userId);
    Task<ShopCatalogDto> GetCatalogAsync(Guid userId);
    Task<BoosterPurchaseResult> PurchaseBoosterAsync(Guid userId);
    Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier);
    Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId);
}
