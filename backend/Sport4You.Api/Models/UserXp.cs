namespace Sport4You.Api.Models;

public class UserXp
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int TotalXp { get; set; }
    public int PrestigeLevel { get; set; }
    public DateTime UpdatedAt { get; set; }
}
