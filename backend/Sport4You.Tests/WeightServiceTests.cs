using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class WeightServiceTests
{
    private static AppDbContext NewDb()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(conn).Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static Guid SeedUser(AppDbContext db)
    {
        var user = new User { Id = Guid.NewGuid(), FirstName = "Wei", LastName = "Ght" };
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    [Fact]
    public async Task UpsertToday_SameDayTwice_UpdatesSingleRow()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        await sut.UpsertTodayAsync(userId, 80.0m);
        await sut.UpsertTodayAsync(userId, 79.2m);

        var rows = await db.WeightEntries.Where(w => w.UserId == userId).ToListAsync();
        Assert.Single(rows);
        Assert.Equal(79.2m, rows[0].WeightKg);
    }

    [Fact]
    public async Task GetHistory_ReturnsEntriesAscendingByDate()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        // Seed a past-dated entry directly, then upsert today.
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5);
        db.WeightEntries.Add(new WeightEntry { Id = Guid.NewGuid(), UserId = userId, Date = pastDate, WeightKg = 85m });
        await db.SaveChangesAsync();
        await sut.UpsertTodayAsync(userId, 80m);

        var history = await sut.GetHistoryAsync(userId);
        Assert.NotNull(history);
        Assert.Equal(2, history!.Entries.Count);
        Assert.Equal(85m, history.Entries[0].WeightKg);        // earliest first
        Assert.True(string.CompareOrdinal(history.Entries[0].Date, history.Entries[1].Date) < 0);
        Assert.Null(history.GoalKg);
    }

    [Fact]
    public async Task SetGoal_InsertThenUpdate_KeepsSingleRow()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        await sut.SetGoalAsync(userId, 78m);
        await sut.SetGoalAsync(userId, 76m);

        var goals = await db.WeightGoals.Where(g => g.UserId == userId).ToListAsync();
        Assert.Single(goals);
        Assert.Equal(76m, goals[0].GoalWeightKg);

        var history = await sut.GetHistoryAsync(userId);
        Assert.Equal(76m, history!.GoalKg);
    }

    [Fact]
    public async Task UnknownUser_ReturnsNullOrFalse()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var ghost = Guid.NewGuid();

        Assert.Null(await sut.GetHistoryAsync(ghost));
        Assert.Null(await sut.UpsertTodayAsync(ghost, 80m));
        Assert.False(await sut.SetGoalAsync(ghost, 78m));
    }
}
