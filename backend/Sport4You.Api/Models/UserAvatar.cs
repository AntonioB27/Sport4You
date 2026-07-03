namespace Sport4You.Api.Models;

public class UserAvatar
{
    public Guid UserId { get; set; }
    public Guid AvatarId { get; set; }
    public DateTime UnlockedAt { get; set; }
}
