using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public record RegisterResult(bool IsConflict, Guid UserId, string? Error)
{
    public static RegisterResult Success(Guid id) => new(false, id, null);
    public static RegisterResult Conflict() => new(true, Guid.Empty, "User with this name already exists");
}

public interface IUserService
{
    Task<RegisterResult> RegisterAsync(RegisterUserRequest request);
    Task<User?> FindByNameAsync(string firstName, string lastName);
}
