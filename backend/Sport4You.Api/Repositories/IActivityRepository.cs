using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public interface IActivityRepository
{
    Task<Activity> CreateAsync(Activity activity);
    Task UpdateAsync(Activity activity);
    Task<List<Activity>> GetByUserIdAsync(Guid userId);
    Task<List<Activity>> GetAllAsync();
    Task<List<Activity>> GetBeforeDateAsync(DateTime before);
}
