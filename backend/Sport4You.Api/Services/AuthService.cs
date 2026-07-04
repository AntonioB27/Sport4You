using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly ITokenService _tokens;
    private readonly IAvatarService _avatars;
    private readonly PasswordHasher<User> _hasher = new();
    private const string GenericError = "Invalid username or password.";

    public AuthService(AppDbContext db, ITokenService tokens, IAvatarService avatars)
    {
        _db = db;
        _tokens = tokens;
        _avatars = avatars;
    }

    public async Task<AuthResult> RegisterAsync(RegisterAuthRequest request)
    {
        var uname = request.Username.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Username == uname))
            return new AuthResult(false, true, null, "Username is already taken.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = request.FirstName,
            LastName = request.LastName,
            Username = uname,
        };
        user.PasswordHash = _hasher.HashPassword(user, request.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _avatars.UnlockAndEquipDefaultAsync(user.Id);

        return Ok(user);
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request)
    {
        var uname = request.Username.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == uname);
        if (user == null || user.PasswordHash.Length == 0)
            return new AuthResult(false, false, null, GenericError);

        var check = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (check == PasswordVerificationResult.Failed)
            return new AuthResult(false, false, null, GenericError);

        return Ok(user);
    }

    private AuthResult Ok(User user) => new(true, false,
        new AuthResponse(_tokens.CreateToken(user), user.Id, user.Username, user.FirstName, user.LastName), null);
}
