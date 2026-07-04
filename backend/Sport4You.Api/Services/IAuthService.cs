using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record AuthResult(bool Success, bool IsConflict, AuthResponse? Response, string? Error);

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(RegisterAuthRequest request);
    Task<AuthResult> LoginAsync(LoginRequest request);
}
