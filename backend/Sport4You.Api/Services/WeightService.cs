using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class WeightService : IWeightService
{
    private readonly AppDbContext _db;
    public WeightService(AppDbContext db) => _db = db;

    public async Task<WeightHistoryDto?> GetHistoryAsync(Guid userId)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return null;

        var entries = await _db.WeightEntries
            .Where(w => w.UserId == userId)
            .OrderBy(w => w.Date)
            .Select(w => new WeightEntryDto(w.Date.ToString("yyyy-MM-dd"), w.WeightKg))
            .ToListAsync();

        var goal = await _db.WeightGoals.FindAsync(userId);
        return new WeightHistoryDto(entries, goal?.GoalWeightKg);
    }

    public async Task<WeightEntryDto?> UpsertTodayAsync(Guid userId, decimal weightKg)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var existing = await _db.WeightEntries
            .FirstOrDefaultAsync(w => w.UserId == userId && w.Date == today);

        if (existing != null)
        {
            existing.WeightKg = weightKg;
        }
        else
        {
            _db.WeightEntries.Add(new WeightEntry
            {
                Id = Guid.NewGuid(), UserId = userId, Date = today, WeightKg = weightKg
            });
        }

        await _db.SaveChangesAsync();
        return new WeightEntryDto(today.ToString("yyyy-MM-dd"), weightKg);
    }

    public async Task<bool> SetGoalAsync(Guid userId, decimal goalKg)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return false;

        var goal = await _db.WeightGoals.FindAsync(userId);
        if (goal != null)
            goal.GoalWeightKg = goalKg;
        else
            _db.WeightGoals.Add(new WeightGoal { UserId = userId, GoalWeightKg = goalKg });

        await _db.SaveChangesAsync();
        return true;
    }
}
