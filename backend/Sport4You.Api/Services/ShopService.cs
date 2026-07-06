using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class ShopService : IShopService
{
    private const int BoosterPrice = 400;
    private const int BoosterActivities = 3;
    private const int NormalBoxPrice = 500;
    private const int SpecialBoxPrice = 1000;

    private readonly AppDbContext _db;
    private readonly ILootBoxService _lootBox;

    public ShopService(AppDbContext db, ILootBoxService lootBox)
    {
        _db = db;
        _lootBox = lootBox;
    }

    public async Task AddCoinsAsync(Guid userId, int coinsEarned)
    {
        if (coinsEarned <= 0) return;
        var row = await GetOrCreateUserXpAsync(userId);
        row.Coins += coinsEarned;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<(int Coins, int BoostedActivitiesRemaining)> GetBalanceAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        return (row?.Coins ?? 0, row?.BoostedActivitiesRemaining ?? 0);
    }

    public async Task<BoosterPurchaseResult> PurchaseBoosterAsync(Guid userId)
    {
        var row = await GetOrCreateUserXpAsync(userId);
        if (row.Coins < BoosterPrice)
            return new BoosterPurchaseResult(false, "Insufficient coins", row.Coins, row.BoostedActivitiesRemaining);

        row.Coins -= BoosterPrice;
        row.BoostedActivitiesRemaining += BoosterActivities;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new BoosterPurchaseResult(true, null, row.Coins, row.BoostedActivitiesRemaining);
    }

    public Task<ShopCatalogDto> GetCatalogAsync(Guid userId) => throw new NotImplementedException();

    public async Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier)
    {
        if (tier != "normal" && tier != "special")
            return new LootBoxPurchaseResult(false, "Invalid loot box tier", 0, 0);

        var price = tier == "normal" ? NormalBoxPrice : SpecialBoxPrice;
        var row = await GetOrCreateUserXpAsync(userId);

        if (row.Coins < price)
            return new LootBoxPurchaseResult(false, "Insufficient coins", row.Coins, await _lootBox.GetPendingCountAsync(userId));

        row.Coins -= price;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _lootBox.EarnBoxAsync(userId, tier == "normal" ? "shop_normal" : "shop_special");

        var pendingCount = await _lootBox.GetPendingCountAsync(userId);
        return new LootBoxPurchaseResult(true, null, row.Coins, pendingCount);
    }

    public Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId) => throw new NotImplementedException();

    private async Task<UserXp> GetOrCreateUserXpAsync(Guid userId)
    {
        var row = await _db.UserXp.FindAsync(userId);
        if (row == null)
        {
            row = new UserXp { UserId = userId, TotalXp = 0, PrestigeLevel = 0, Coins = 0, BoostedActivitiesRemaining = 0, UpdatedAt = DateTime.UtcNow };
            _db.UserXp.Add(row);
            await _db.SaveChangesAsync();
        }
        return row;
    }
}
