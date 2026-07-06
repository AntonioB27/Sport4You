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

    public async Task<ShopCatalogDto> GetCatalogAsync(Guid userId)
    {
        var (coins, boostedActivitiesRemaining) = await GetBalanceAsync(userId);

        var shopAvatars = await _db.Avatars.Where(a => a.UnlockType == "shop").ToListAsync();
        var ownedIds = await _db.UserAvatars
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AvatarId)
            .ToListAsync();
        var ownedSet = ownedIds.ToHashSet();

        var avatarDtos = shopAvatars
            .Select(a => new ShopAvatarDto(
                a.Id, a.Name, a.Description, a.ImagePath,
                a.ShopRarity ?? "common", a.ShopPrice ?? 0,
                ownedSet.Contains(a.Id)))
            .ToList();

        return new ShopCatalogDto(
            coins,
            boostedActivitiesRemaining,
            new ShopBoosterDto(BoosterPrice, BoosterActivities, 1.5),
            [
                new ShopLootBoxDto("normal", NormalBoxPrice, 60, 30, 10),
                new ShopLootBoxDto("special", SpecialBoxPrice, 30, 45, 25),
            ],
            avatarDtos);
    }

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

    public async Task<AvatarPurchaseResult> PurchaseAvatarAsync(Guid userId, Guid avatarId)
    {
        var avatar = await _db.Avatars.FindAsync(avatarId);
        if (avatar == null || avatar.UnlockType != "shop" || avatar.ShopPrice == null)
            return new AvatarPurchaseResult(false, "Avatar is not available for purchase", 0);

        var alreadyOwned = await _db.UserAvatars.AnyAsync(ua => ua.UserId == userId && ua.AvatarId == avatarId);
        if (alreadyOwned)
            return new AvatarPurchaseResult(false, "Avatar already owned", 0);

        var row = await GetOrCreateUserXpAsync(userId);
        if (row.Coins < avatar.ShopPrice.Value)
            return new AvatarPurchaseResult(false, "Insufficient coins", row.Coins);

        row.Coins -= avatar.ShopPrice.Value;
        row.UpdatedAt = DateTime.UtcNow;
        _db.UserAvatars.Add(new UserAvatar { UserId = userId, AvatarId = avatarId, UnlockedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        return new AvatarPurchaseResult(true, null, row.Coins);
    }

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
