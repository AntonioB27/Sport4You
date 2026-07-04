using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public class BorderService : IBorderService
{
    private readonly AppDbContext _db;
    public BorderService(AppDbContext db) => _db = db;

    public async Task<List<BorderStatusDto>> GetUserBordersAsync(Guid userId)
    {
        var all = await _db.Borders.ToListAsync();
        var owned = await _db.UserBorders.Where(ub => ub.UserId == userId).ToListAsync();
        var ownedMap = owned.ToDictionary(ub => ub.BorderId);

        return all.Select(b =>
        {
            ownedMap.TryGetValue(b.Id, out var ub);
            return new BorderStatusDto(
                b.Id, b.Name, b.Rarity, b.BorderCss, b.ImagePath,
                ub != null, ub?.UnlockedAt, ub?.IsActive ?? false);
        }).ToList();
    }

    public async Task<bool> SetActiveBorderAsync(Guid userId, Guid borderId)
    {
        var isOwned = await _db.UserBorders
            .AnyAsync(ub => ub.UserId == userId && ub.BorderId == borderId);
        if (!isOwned) return false;

        var all = await _db.UserBorders.Where(ub => ub.UserId == userId).ToListAsync();
        foreach (var ub in all)
            ub.IsActive = ub.BorderId == borderId;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<Dictionary<Guid, string>> GetActiveBorderCssMapAsync()
    {
        var activeBorders = await _db.UserBorders.Where(ub => ub.IsActive).ToListAsync();
        var borderIds = activeBorders.Select(ub => ub.BorderId).ToList();
        var borders = await _db.Borders
            .Where(b => borderIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.BorderCss);

        return activeBorders
            .Where(ub => borders.ContainsKey(ub.BorderId))
            .ToDictionary(ub => ub.UserId, ub => borders[ub.BorderId]);
    }
}
