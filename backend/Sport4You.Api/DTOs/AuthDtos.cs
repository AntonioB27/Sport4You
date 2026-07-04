using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class RegisterAuthRequest
{
    [Required] public string FirstName { get; set; } = string.Empty;
    [Required] public string LastName { get; set; } = string.Empty;
    [Required, MinLength(3)] public string Username { get; set; } = string.Empty;
    [Required, MinLength(6)] public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required] public string Username { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

public record AuthResponse(string Token, Guid UserId, string Username, string FirstName, string LastName);
