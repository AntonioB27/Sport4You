using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class LogActivityRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Datetime { get; set; } = string.Empty;

    public string? Sport { get; set; }
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
}
