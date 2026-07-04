using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User> CreateAsync(User user);
    Task<List<User>> GetAllAsync();
}
