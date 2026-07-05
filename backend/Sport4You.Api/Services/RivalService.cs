using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public class RivalService : IRivalService
{
    private readonly AppDbContext _db;
    public RivalService(AppDbContext db) => _db = db;

    public async Task<Guid?> GetRivalUserIdAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        return user?.RivalUserId;
    }

    public async Task<SetRivalResult> SetRivalAsync(Guid userId, Guid rivalUserId)
    {
        if (rivalUserId == userId)
            return new SetRivalResult(false, "You cannot set yourself as your rival.");

        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return new SetRivalResult(false, "User not found.");

        var rivalExists = await _db.Users.AnyAsync(u => u.Id == rivalUserId);
        if (!rivalExists)
            return new SetRivalResult(false, "Rival not found.");

        var myPoints = await _db.Activities.Where(a => a.UserId == userId).SumAsync(a => a.Points);
        var rivalPoints = await _db.Activities.Where(a => a.UserId == rivalUserId).SumAsync(a => a.Points);

        user.RivalUserId = rivalUserId;
        user.RivalAheadLastSeen = myPoints > rivalPoints;
        await _db.SaveChangesAsync();
        return new SetRivalResult(true, null);
    }

    public async Task ClearRivalAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return;
        user.RivalUserId = null;
        user.RivalAheadLastSeen = null;
        await _db.SaveChangesAsync();
    }

    public async Task<RivalStatusDto?> GetRivalStatusAsync(Guid userId, List<LeaderboardEntryDto> leaderboard)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user?.RivalUserId == null) return null;

        var rivalEntry = leaderboard.FirstOrDefault(e => e.UserId == user.RivalUserId.Value);
        if (rivalEntry == null) return null; // rival row vanished from the leaderboard — fail gracefully

        var myEntry = leaderboard.FirstOrDefault(e => e.UserId == userId);
        var myPoints = myEntry?.TotalPoints ?? 0;
        var imAheadNow = myPoints > rivalEntry.TotalPoints; // tie counts as not-ahead

        var justFlipped = user.RivalAheadLastSeen.HasValue && user.RivalAheadLastSeen.Value != imAheadNow;
        user.RivalAheadLastSeen = imAheadNow;
        await _db.SaveChangesAsync();

        return new RivalStatusDto(
            rivalEntry.UserId, rivalEntry.FirstName, rivalEntry.LastName,
            rivalEntry.ActiveAvatarImagePath, rivalEntry.ActiveBorderCss,
            myPoints, rivalEntry.TotalPoints, myPoints - rivalEntry.TotalPoints,
            imAheadNow, justFlipped);
    }
}
