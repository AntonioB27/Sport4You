namespace Sport4You.Api.Models;

public class UserBorder
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid BorderId { get; set; }
    public DateTime UnlockedAt { get; set; }
    public bool IsActive { get; set; }
}
