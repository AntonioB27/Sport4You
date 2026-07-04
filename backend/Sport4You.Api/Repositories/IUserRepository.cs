using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<bool> ExistsByNameAsync(string firstName, string lastName);
    Task<User?> GetByNameAsync(string firstName, string lastName);
    Task<User> CreateAsync(User user);
    Task<List<User>> GetAllAsync();
}
