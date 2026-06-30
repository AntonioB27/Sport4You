using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _users;
    public UserService(IUserRepository users) => _users = users;

    public async Task<RegisterResult> RegisterAsync(RegisterUserRequest request)
    {
        if (await _users.ExistsByNameAsync(request.FirstName, request.LastName))
            return RegisterResult.Conflict();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = request.FirstName,
            LastName = request.LastName
        };

        await _users.CreateAsync(user);
        return RegisterResult.Success(user.Id);
    }
}
