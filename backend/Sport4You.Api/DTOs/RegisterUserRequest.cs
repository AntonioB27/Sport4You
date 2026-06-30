using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class RegisterUserRequest
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;
}
