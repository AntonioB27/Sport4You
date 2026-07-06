using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class ParseActivityRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Text { get; set; } = string.Empty;
}
