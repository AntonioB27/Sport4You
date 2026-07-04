using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class LootBoxService : ILootBoxService
{
    private readonly AppDbContext _db;
    public LootBoxService(AppDbContext db) => _db = db;

    public async Task EarnBoxAsync(Guid userId, string reason)
    {
        if (reason == "streak")
        {
            var today = DateTime.UtcNow.Date;
            var alreadyEarnedToday = await _db.LootBoxes.AnyAsync(lb =>
                lb.UserId == userId && lb.EarnReason == "streak" &&
                lb.EarnedAt >= today && lb.EarnedAt < today.AddDays(1));
            if (alreadyEarnedToday) return;
        }

        _db.LootBoxes.Add(new LootBox
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            EarnReason = reason,
            EarnedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    public async Task<OpenBoxResultDto> OpenBoxAsync(Guid userId)
    {
        var box = await _db.LootBoxes
            .Where(lb => lb.UserId == userId && lb.OpenedAt == null)
            .OrderBy(lb => lb.EarnedAt)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("No pending boxes");

        var random = Random.Shared;
        var type = random.Next(2) == 0 ? "avatar" : "border";

        var rarityRoll = random.NextDouble();
        var rarity = rarityRoll < 0.6 ? "common" : rarityRoll < 0.9 ? "rare" : "legendary";

        var candidates = await _db.LootBoxRewards
            .Where(r => r.Type == type && r.Rarity == rarity)
            .ToListAsync();

        if (candidates.Count == 0)
            candidates = await _db.LootBoxRewards.Where(r => r.Rarity == rarity).ToListAsync();

        var reward = candidates[random.Next(candidates.Count)];
        type = reward.Type;

        var isDuplicate = type == "avatar"
            ? await _db.UserAvatars.AnyAsync(ua => ua.UserId == userId && ua.AvatarId == reward.AvatarId)
            : await _db.UserBorders.AnyAsync(ub => ub.UserId == userId && ub.BorderId == reward.BorderId);

        var duplicateXp = 0;
        var now = DateTime.UtcNow;

        if (!isDuplicate)
        {
            if (type == "avatar" && reward.AvatarId.HasValue)
                _db.UserAvatars.Add(new UserAvatar
                    { UserId = userId, AvatarId = reward.AvatarId.Value, UnlockedAt = now });
            else if (type == "border" && reward.BorderId.HasValue)
                _db.UserBorders.Add(new UserBorder
                    { Id = Guid.NewGuid(), UserId = userId, BorderId = reward.BorderId.Value,
                      UnlockedAt = now, IsActive = false });
        }
        else
        {
            duplicateXp = rarity switch
            {
                "common"    => 50,
                "rare"      => 150,
                "legendary" => 400,
                _           => 50,
            };
        }

        box.OpenedAt = now;
        box.RewardId = reward.Id;
        box.WasDuplicate = isDuplicate;
        box.DuplicateXpAwarded = duplicateXp;

        await _db.SaveChangesAsync();

        var remaining = await _db.LootBoxes
            .CountAsync(lb => lb.UserId == userId && lb.OpenedAt == null);

        return new OpenBoxResultDto(
            reward.Type, reward.Rarity, reward.Name, reward.ImagePath,
            isDuplicate, duplicateXp, remaining);
    }

    public Task<int> GetPendingCountAsync(Guid userId)
        => _db.LootBoxes.CountAsync(lb => lb.UserId == userId && lb.OpenedAt == null);
}
