// backend/Sport4You.Api/Services/AvatarService.cs
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class AvatarService : IAvatarService
{
    private readonly AppDbContext _db;
    private readonly IXpService _xp;

    public AvatarService(AppDbContext db, IXpService xp)
    {
        _db = db;
        _xp = xp;
    }

    public async Task<List<AvatarStatusDto>> GetUserAvatarsAsync(Guid userId)
    {
        var all = await _db.Avatars
            .ToListAsync();
        var unlocked = await _db.UserAvatars
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
        var unlockedMap = unlocked.ToDictionary(ua => ua.AvatarId);

        var user = await _db.Users.FindAsync(userId);
        var activeId = user?.ActiveAvatarId;

        return all.Select(a =>
        {
            unlockedMap.TryGetValue(a.Id, out var ua);
            return new AvatarStatusDto(
                a.Id, a.Name, a.Description, a.ImagePath,
                a.UnlockType, a.UnlockValue,
                ua != null, ua?.UnlockedAt, a.Id == activeId);
        }).ToList();
    }

    public async Task<AvatarStatusDto?> GetActiveAvatarAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user?.ActiveAvatarId == null) return null;

        var avatar = await _db.Avatars.FindAsync(user.ActiveAvatarId.Value);
        if (avatar == null) return null;

        var ua = await _db.UserAvatars
            .FirstOrDefaultAsync(x => x.UserId == userId && x.AvatarId == avatar.Id);

        return new AvatarStatusDto(
            avatar.Id, avatar.Name, avatar.Description, avatar.ImagePath,
            avatar.UnlockType, avatar.UnlockValue, true, ua?.UnlockedAt, true);
    }

    public async Task UnlockAndEquipDefaultAsync(Guid userId)
    {
        var defaultAvatar = await _db.Avatars
            .FirstOrDefaultAsync(a => a.UnlockType == "default");
        if (defaultAvatar == null) return;

        var already = await _db.UserAvatars
            .AnyAsync(ua => ua.UserId == userId && ua.AvatarId == defaultAvatar.Id);

        if (!already)
            _db.UserAvatars.Add(new UserAvatar
            {
                UserId = userId, AvatarId = defaultAvatar.Id, UnlockedAt = DateTime.UtcNow,
            });

        var user = await _db.Users.FindAsync(userId);
        if (user != null)
            user.ActiveAvatarId = defaultAvatar.Id;

        await _db.SaveChangesAsync();
    }

    public async Task<bool> SetActiveAvatarAsync(Guid userId, Guid avatarId)
    {
        var isUnlocked = await _db.UserAvatars
            .AnyAsync(ua => ua.UserId == userId && ua.AvatarId == avatarId);
        if (!isUnlocked) return false;

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return false;

        user.ActiveAvatarId = avatarId;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<UnlockedAvatarDto>> EvaluateAvatarsAsync(Guid userId)
    {
        // Load IDs the user has already unlocked
        var unlockedIds = await _db.UserAvatars
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AvatarId)
            .ToListAsync();

        // Only evaluate non-default avatars the user hasn't earned yet
        var unearned = await _db.Avatars
            .Where(a => !unlockedIds.Contains(a.Id) && a.UnlockType != "default")
            .ToListAsync();

        if (unearned.Count == 0) return [];

        // Compute aggregates
        var totalActivities = await _db.Activities
            .CountAsync(a => a.UserId == userId);

        var activityDates = await _db.Activities
            .Where(a => a.UserId == userId)
            .Select(a => a.DateTime)
            .ToListAsync();
        var streak = ActivityStreakHelper.ComputeCurrentStreak(activityDates);

        var xpRow = await _db.UserXp.FindAsync(userId);
        var level = _xp.GetLevelInfo(xpRow?.TotalXp ?? 0).Level;

        var earnedAchievementIdList = await _db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();
        var earnedAchievementIds = earnedAchievementIdList.ToHashSet();

        // Evaluate each unearned avatar against unlock conditions
        var toUnlock = unearned.Where(a => a.UnlockType switch
        {
            "level_reached"      => level >= (int)a.UnlockValue,
            "achievement_earned" => a.UnlockAchievementId.HasValue
                                    && earnedAchievementIds.Contains(a.UnlockAchievementId.Value),
            "streak_days"        => streak >= (int)a.UnlockValue,
            "activities_logged"  => totalActivities >= (int)a.UnlockValue,
            _                    => false,
        }).ToList();

        if (toUnlock.Count == 0) return [];

        var now = DateTime.UtcNow;
        foreach (var a in toUnlock)
            _db.UserAvatars.Add(new UserAvatar { UserId = userId, AvatarId = a.Id, UnlockedAt = now });

        await _db.SaveChangesAsync();

        return toUnlock
            .Select(a => new UnlockedAvatarDto(a.Id, a.Name, a.Description, a.ImagePath))
            .ToList();
    }

    public async Task<Dictionary<Guid, string>> GetAvatarImageMapAsync()
        => await _db.Avatars.ToDictionaryAsync(a => a.Id, a => a.ImagePath);
}
