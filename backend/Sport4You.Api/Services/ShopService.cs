using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class ShopService : IShopService
{
    private const int BoosterPrice = 400;
    private const int BoosterActivities = 3;

    private readonly AppDbContext _db;
    // Used by PurchaseLootBoxAsync, implemented in a later task.
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
    public Task<LootBoxPurchaseResult> PurchaseLootBoxAsync(Guid userId, string tier) => throw new NotImplementedException();
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
