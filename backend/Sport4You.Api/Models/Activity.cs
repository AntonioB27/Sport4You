namespace Sport4You.Api.Models;

public class Activity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime DateTime { get; set; }
    public string Sport { get; set; } = string.Empty;
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
    public int Points { get; set; }
}
