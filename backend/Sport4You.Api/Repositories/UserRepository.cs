using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    public Task<User?> GetByIdAsync(Guid id)
        => _db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<bool> ExistsByNameAsync(string firstName, string lastName)
        => _db.Users.AnyAsync(u => u.FirstName == firstName && u.LastName == lastName);

    public async Task<User> CreateAsync(User user)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    public Task<List<User>> GetAllAsync()
        => _db.Users.ToListAsync();
}
