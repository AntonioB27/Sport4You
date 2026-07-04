// backend/Sport4You.Api/Services/UserService.cs
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _users;
    private readonly IAvatarService _avatars;

    public UserService(IUserRepository users, IAvatarService avatars)
    {
        _users = users;
        _avatars = avatars;
    }

    public async Task<RegisterResult> RegisterAsync(RegisterUserRequest request)
    {
        if (await _users.ExistsByNameAsync(request.FirstName, request.LastName))
            return RegisterResult.Conflict();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = request.FirstName,
            LastName = request.LastName,
        };

        await _users.CreateAsync(user);
        await _avatars.UnlockAndEquipDefaultAsync(user.Id);
        return RegisterResult.Success(user.Id);
    }

    public Task<User?> FindByNameAsync(string firstName, string lastName)
        => _users.GetByNameAsync(firstName, lastName);
}
