namespace Sport4You.Api.Models;

public class XpTransaction
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Source { get; set; } = string.Empty;  // "activity" | "mission" | "mission_sweep"
    public Guid? SourceId { get; set; }
    public int XpEarned { get; set; }
    public DateTime CreatedAt { get; set; }
}
