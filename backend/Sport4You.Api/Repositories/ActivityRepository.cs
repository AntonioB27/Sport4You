using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public class ActivityRepository : IActivityRepository
{
    private readonly AppDbContext _db;
    public ActivityRepository(AppDbContext db) => _db = db;

    public async Task<Activity> CreateAsync(Activity activity)
    {
        _db.Activities.Add(activity);
        await _db.SaveChangesAsync();
        return activity;
    }

    public async Task UpdateAsync(Activity activity)
    {
        _db.Activities.Update(activity);
        await _db.SaveChangesAsync();
    }

    public Task<List<Activity>> GetByUserIdAsync(Guid userId)
        => _db.Activities.Where(a => a.UserId == userId).OrderByDescending(a => a.DateTime).ToListAsync();

    public Task<List<Activity>> GetAllAsync()
        => _db.Activities.ToListAsync();

    public Task<List<Activity>> GetBeforeDateAsync(DateTime before)
        => _db.Activities.Where(a => a.DateTime < before).ToListAsync();
}
